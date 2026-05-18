import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";
import { createId } from "../../shared/utils/createId.js";

function buildToolRequest(taskInput: string): { toolName: string; args: Record<string, unknown> } {
  const normalized = taskInput.toLowerCase();

  if (normalized.includes("git diff") || normalized.includes("diff")) {
    return {
      toolName: "git_diff",
      args: {},
    };
  }

  if (normalized.includes("read file")) {
    return {
      toolName: "read_file",
      args: {
        path: "README.md",
      },
    };
  }

  if (normalized.includes("write file")) {
    return {
      toolName: "write_file",
      args: {
        path: "workspaces/demo/generated.txt",
        content: `Generated from task: ${taskInput}\n`,
      },
    };
  }

  if (normalized.includes("patch file")) {
    return {
      toolName: "patch_file",
      args: {
        path: "workspaces/demo/generated.txt",
        search: "Generated",
        replace: "Patched",
      },
    };
  }

  if (normalized.includes("shell")) {
    return {
      toolName: "shell_exec",
      args: {
        command: "git",
        argv: ["status"],
      },
    };
  }

  return {
    toolName: "list_files",
    args: {
      path: ".",
    },
  };
}

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: EnrichedRunContext): Promise<void> {
      const runId = context.runId;
      const availableTools = deps.toolRegistry.listTools();
      const request = buildToolRequest(context.task.input);
      const selectedTool = availableTools.find((tool) => tool.name === request.toolName);

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
        args: request.args,
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
