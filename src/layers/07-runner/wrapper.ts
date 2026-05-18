import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";
import { createId } from "../../shared/utils/createId.js";
import { buildFinalAnswer, summarizeToolOutcome } from "./planner.js";
import type { PermissionLevel } from "../../shared/types/permission.js";

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: EnrichedRunContext) {
      const runId = context.runId;
      const availableTools = deps.toolRegistry.listTools();
      let stepCount = 0;

      const executeToolCall = async (plannedCall: {
        toolName: string;
        permission: PermissionLevel;
        args: Record<string, unknown>;
        reason: string;
      }) => {
        const toolCallId = createId("toolcall");
        const toolResultPromise = deps.eventbus.waitForToolResult(runId, toolCallId);
        deps.eventbus.publish({
          type: "tool.call.requested",
          runId,
          toolCallId,
          toolName: plannedCall.toolName,
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
            toolName: plannedCall.toolName,
            toolOk: toolResult.ok,
            reason: plannedCall.reason,
          },
        });

        if (!toolResult.ok) {
          throw new Error(toolResult.error);
        }

        return toolSummary;
      };

      if (deps.provider.runWithTools) {
        const providerRunResult = await deps.provider.runWithTools(context, availableTools, {
          executeToolCall,
          onStepFinish(event) {
            stepCount = Math.max(stepCount, event.stepNumber + 1);
          },
        });
        deps.eventbus.publish({
          type: "agent.answer.produced",
          runId,
          answer: providerRunResult.finalAnswer,
        });
        return providerRunResult;
      }

      const plan = await deps.provider.plan(context, availableTools);
      if (plan.plannedToolCalls.length === 0) {
        deps.eventbus.publish({
          type: "agent.step.finished",
          runId,
          stepNumber: 1,
          usage: {
            mode: "no-tools",
            contextKeys: Object.keys(context),
          },
        });
        return {
          stepsUsed: 0,
          finalAnswer: "No tool calls were executed.",
          toolSummaries: [],
        };
      }

      const toolSummaries = [];

      for (const plannedCall of plan.plannedToolCalls) {
        const selectedTool = availableTools.find((tool) => tool.name === plannedCall.toolName);
        if (!selectedTool) {
          throw new Error(`Runner selected an unknown tool: ${plannedCall.toolName}`);
        }
        void selectedTool;
        const toolSummary = await executeToolCall(plannedCall);
        toolSummaries.push(toolSummary);
      }

      const finalAnswer = buildFinalAnswer(toolSummaries);
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
