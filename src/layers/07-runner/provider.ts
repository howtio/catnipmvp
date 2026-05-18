import type { EnrichedRunContext } from "../06-skills/index.js";
import type { PermissionLevel } from "../../shared/types/permission.js";

export interface PlannedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  permission: PermissionLevel;
  reason: string;
}

export interface RunnerStepPlan {
  plannedToolCalls: PlannedToolCall[];
  finalAnswerPrompt: string;
}

export interface RunnerProvider {
  plan(context: EnrichedRunContext): Promise<RunnerStepPlan>;
}

function buildPlannedToolCall(
  toolName: string,
  permission: PermissionLevel,
  args: Record<string, unknown>,
  reason: string,
): PlannedToolCall {
  return {
    toolName,
    permission,
    args,
    reason,
  };
}

function includesAny(input: string, patterns: string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}

export function createHeuristicRunnerProvider(): RunnerProvider {
  return {
    async plan(context: EnrichedRunContext): Promise<RunnerStepPlan> {
      const taskInput = context.task.input.toLowerCase();
      const plannedToolCalls: PlannedToolCall[] = [];

      if (includesAny(taskInput, ["git diff", "diff"])) {
        plannedToolCalls.push(
          buildPlannedToolCall("git_diff", "medium", {}, "Inspect current git diff for workspace changes."),
        );
      }

      if (includesAny(taskInput, ["read file", "readme"])) {
        plannedToolCalls.push(
          buildPlannedToolCall("read_file", "low", { path: "README.md" }, "Read the default project readme."),
        );
      }

      if (includesAny(taskInput, ["write file", "generate file", "create file"])) {
        plannedToolCalls.push(
          buildPlannedToolCall(
            "write_file",
            "medium",
            {
              path: "workspaces/demo/generated.txt",
              content: `Generated from task: ${context.task.input}\n`,
            },
            "Create a demo file for workflow validation.",
          ),
        );
      }

      if (includesAny(taskInput, ["patch file", "replace text", "update file"])) {
        plannedToolCalls.push(
          buildPlannedToolCall(
            "patch_file",
            "medium",
            {
              path: "workspaces/demo/generated.txt",
              search: "Generated",
              replace: "Patched",
            },
            "Apply a controlled text patch to the demo file.",
          ),
        );
      }

      if (includesAny(taskInput, ["shell", "command", "status"])) {
        plannedToolCalls.push(
          buildPlannedToolCall(
            "shell_exec",
            "medium",
            {
              command: "git",
              argv: ["status"],
            },
            "Run a guarded git status command.",
          ),
        );
      }

      if (plannedToolCalls.length === 0) {
        plannedToolCalls.push(
          buildPlannedToolCall("list_files", "low", { path: "." }, "List workspace entries as a safe default."),
        );
      }

      return {
        plannedToolCalls,
        finalAnswerPrompt: "Summarize the tool results for the user.",
      };
    },
  };
}
