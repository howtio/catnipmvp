import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";
import { createId } from "../../shared/utils/createId.js";
import { buildFinalAnswer, summarizeToolOutcome } from "./planner.js";

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: EnrichedRunContext) {
      const runId = context.runId;
      const availableTools = deps.toolRegistry.listTools();
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
      let stepNumber = 0;

      for (const plannedCall of plan.plannedToolCalls) {
        stepNumber += 1;
        const selectedTool = availableTools.find((tool) => tool.name === plannedCall.toolName);
        if (!selectedTool) {
          throw new Error(`Runner selected an unknown tool: ${plannedCall.toolName}`);
        }

        const toolCallId = createId("toolcall");
        const toolResultPromise = deps.eventbus.waitForToolResult(runId, toolCallId);
        deps.eventbus.publish({
          type: "tool.call.requested",
          runId,
          toolCallId,
          toolName: selectedTool.name,
          args: plannedCall.args,
          workspaceRoot: context.workspace.root,
          permission: selectedTool.permission,
        });

        const toolResult = await toolResultPromise;
        const toolSummary = summarizeToolOutcome(plannedCall, toolResult);
        toolSummaries.push(toolSummary);

        deps.eventbus.publish({
          type: "agent.step.finished",
          runId,
          stepNumber,
          usage: {
            mode: "tool-skeleton",
            contextKeys: Object.keys(context),
            toolName: selectedTool.name,
            toolOk: toolResult.ok,
            reason: plannedCall.reason,
          },
        });

        if (!toolResult.ok) {
          throw new Error(toolResult.error);
        }
      }

      const finalAnswer = buildFinalAnswer(toolSummaries);
      deps.eventbus.publish({
        type: "agent.answer.produced",
        runId,
        answer: finalAnswer,
      });

      return {
        stepsUsed: stepNumber,
        finalAnswer,
        toolSummaries,
      };
    },
  };
}
