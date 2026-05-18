import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";
import { createId } from "../../shared/utils/createId.js";

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: EnrichedRunContext): Promise<void> {
      const runId = context.runId;
      const availableTools = deps.toolRegistry.listTools();
      const selectedTool = availableTools[0];

      if (!selectedTool) {
        deps.eventbus.publish({
          type: "agent.step.finished",
          runId,
          stepNumber: 1,
          usage: {
            mode: "no-tools",
            contextKeys: Object.keys(context),
          },
        });
        return;
      }

      const toolCallId = createId("toolcall");
      const toolResultPromise = deps.eventbus.waitForToolResult(runId, toolCallId);
      deps.eventbus.publish({
        type: "tool.call.requested",
        runId,
        toolCallId,
        toolName: selectedTool.name,
        args: {
          taskInput: context.task.input,
          workspaceSummary: context.workspace.topLevelEntries.slice(0, 5),
        },
        workspaceRoot: context.workspace.root,
        permission: selectedTool.permission,
      });

      const toolResult = await toolResultPromise;
      deps.eventbus.publish({
        type: "agent.step.finished",
        runId,
        stepNumber: 1,
        usage: {
          mode: "tool-skeleton",
          contextKeys: Object.keys(context),
          toolName: selectedTool.name,
          toolOk: toolResult.ok,
        },
      });

      if (!toolResult.ok) {
        throw new Error(toolResult.error);
      }
    },
  };
}
