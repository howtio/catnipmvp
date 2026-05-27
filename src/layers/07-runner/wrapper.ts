import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { MemoryEnrichedRunContext } from "../06.5-memory/index.js";
import { createId } from "../../shared/utils/createId.js";
import { buildFinalAnswer, summarizeToolOutcome } from "./planner.js";
import type { PermissionLevel } from "../../shared/types/permission.js";
import type { RunnerExecutionLimits } from "./types.js";
import type { ToolExecutionSummary } from "./planner.js";

const DEFAULT_LIMITS: RunnerExecutionLimits = {
  maxSteps: 5,
  continueOnToolError: false,
  maxToolRetries: 0,
};

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  const limits: RunnerExecutionLimits = {
    ...DEFAULT_LIMITS,
    ...deps.limits,
  };

  return {
    async run(context: MemoryEnrichedRunContext) {
      const runId = context.runId;
      const availableTools = deps.toolRegistry.listTools();
      let stepCount = 0;
      const toolSummaries: ToolExecutionSummary[] = [];

      const ensureStepBudget = () => {
        if (stepCount >= limits.maxSteps) {
          throw new Error(`Runner step limit reached (${limits.maxSteps}).`);
        }
      };

      const executeToolCall = async (plannedCall: {
        name: string;
        permission: PermissionLevel;
        args: Record<string, unknown>;
        reason: string;
      }) => {
        let attempt = 0;

        for (;;) {
          ensureStepBudget();
          deps.eventbus.publish({
            type: "agent.reasoning.summary",
            runId,
            stepNumber: stepCount + 1,
            summary: `${plannedCall.reason} Tool: ${plannedCall.name}. Attempt ${attempt + 1}.`,
          });
          const toolCallId = createId("toolcall");
          const toolResultPromise = deps.eventbus.waitForToolResult(runId, toolCallId);
          deps.eventbus.publish({
            type: "tool.call.requested",
            runId,
            toolCallId,
            toolName: plannedCall.name,
            args: plannedCall.args,
            workspaceRoot: context.workspace.root,
            permission: plannedCall.permission,
          });

          const toolResult = await toolResultPromise;
          const toolSummary = summarizeToolOutcome(plannedCall, toolResult);
          stepCount += 1;
          deps.eventbus.publish({
            type: "agent.step.finished",
            runId,
            stepNumber: stepCount,
            usage: {
              mode: "tool-skeleton",
              contextKeys: Object.keys(context),
              toolName: plannedCall.name,
              toolOk: toolResult.ok,
              reason: plannedCall.reason,
              attempt: attempt + 1,
            },
          });

          if (toolResult.ok) {
            toolSummaries.push(toolSummary);
            return toolSummary;
          }

          if (attempt < limits.maxToolRetries) {
            attempt += 1;
            deps.eventbus.publish({
              type: "agent.reasoning.summary",
              runId,
              stepNumber: stepCount,
              summary: `Tool ${plannedCall.name} failed and will be retried. ${toolResult.error}`,
            });
            continue;
          }

          toolSummaries.push(toolSummary);
          if (!limits.continueOnToolError) {
            throw new Error(toolResult.error);
          }
          deps.eventbus.publish({
            type: "agent.reasoning.summary",
            runId,
            stepNumber: stepCount,
            summary: `Tool ${plannedCall.name} failed and the run will continue. ${toolResult.error}`,
          });
          return toolSummary;
        }
      };

      if (deps.provider.runWithTools) {
        deps.eventbus.publish({
          type: "agent.plan.generated",
          runId,
          mode: "provider-tool-calling",
          plannedToolCalls: [],
          finalAnswerPrompt: "Provider-managed tool calling loop.",
        });
        const providerRunResult = await deps.provider.runWithTools(context, availableTools, {
          executeToolCall,
          maxSteps: limits.maxSteps,
          onStepFinish(event) {
            stepCount = Math.max(stepCount, event.stepNumber + 1);
            deps.eventbus.publish({
              type: "agent.reasoning.summary",
              runId,
              stepNumber: event.stepNumber,
              summary: event.text,
              toolCalls: event.toolCalls,
              toolResults: event.toolResults,
            });
          },
        });
        deps.eventbus.publish({
          type: "agent.answer.produced",
          runId,
          answer: providerRunResult.finalAnswer,
        });
        return {
          ...providerRunResult,
          stepsUsed: stepCount,
          toolSummaries: providerRunResult.toolSummaries.length > 0 ? providerRunResult.toolSummaries : toolSummaries,
        };
      }

      const plan = await deps.provider.plan(context, availableTools);
      deps.eventbus.publish({
        type: "agent.plan.generated",
        runId,
        mode: "planned-tool-calls",
        plannedToolCalls: plan.plannedToolCalls.map((plannedCall) => ({
          toolName: plannedCall.name,
          reason: plannedCall.reason,
          args: plannedCall.args,
        })),
        finalAnswerPrompt: plan.finalAnswerPrompt,
      });
      if (plan.plannedToolCalls.length === 0) {
        deps.eventbus.publish({
          type: "agent.reasoning.summary",
          runId,
          stepNumber: 1,
          summary: "No tool calls planned. Using model's direct answer.",
        });
        deps.eventbus.publish({
          type: "agent.step.finished",
          runId,
          stepNumber: 1,
          usage: {
            mode: "no-tools",
            contextKeys: Object.keys(context),
          },
        });
        deps.eventbus.publish({
          type: "agent.answer.produced",
          runId,
          answer: plan.finalAnswerPrompt,
        });
        return {
          stepsUsed: 0,
          finalAnswer: plan.finalAnswerPrompt,
          toolSummaries: [],
        };
      }

      for (const plannedCall of plan.plannedToolCalls) {
        ensureStepBudget();
        const selectedTool = availableTools.find((tool) => tool.name === plannedCall.name);
        if (!selectedTool) {
          throw new Error(`Runner selected an unknown tool: ${plannedCall.name}`);
        }
        void selectedTool;
        await executeToolCall(plannedCall);
      }

      const finalAnswer = plan.finalAnswerPrompt || buildFinalAnswer(toolSummaries);
      deps.eventbus.publish({
        type: "agent.answer.produced",
        runId,
        answer: finalAnswer,
      });

      return {
        stepsUsed: stepCount,
        finalAnswer,
        toolSummaries,
      };
    },
  };
}
