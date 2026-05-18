import { generateObject } from "ai";
import { z } from "zod";
import type { EnrichedRunContext } from "../06-skills/index.js";
import type { PermissionLevel } from "../../shared/types/permission.js";

export interface AvailableTool {
  name: string;
  description: string;
  permission: PermissionLevel;
}

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
  plan(context: EnrichedRunContext, availableTools: AvailableTool[]): Promise<RunnerStepPlan>;
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

const aiSdkPlanSchema = z.object({
  plannedToolCalls: z.array(
    z.object({
      toolName: z.string(),
      args: z.record(z.string(), z.unknown()),
      reason: z.string(),
    }),
  ),
  finalAnswerPrompt: z.string(),
});

export interface AiSdkRunnerProviderOptions {
  model?: string;
}

export function createAiSdkRunnerProvider(options: AiSdkRunnerProviderOptions = {}): RunnerProvider {
  const model = options.model ?? process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v3.2";

  return {
    async plan(context: EnrichedRunContext, availableTools: AvailableTool[]): Promise<RunnerStepPlan> {
      const toolList = availableTools
        .map((tool) => `- ${tool.name} (${tool.permission}): ${tool.description}`)
        .join("\n");

      const prompt = [
        "You are planning tool usage for a coding agent runtime.",
        "Return only tool calls that exist in the allowed tool list.",
        "Prefer the minimum number of tool calls needed to answer the task.",
        `Task: ${context.task.input}`,
        `Allowed tools:\n${toolList}`,
        `Workspace root: ${context.workspace.root}`,
      ].join("\n\n");

      const { object } = await generateObject({
        model,
        schema: aiSdkPlanSchema,
        prompt,
      });

      const toolMap = new Map(availableTools.map((tool) => [tool.name, tool]));
      const plannedToolCalls = object.plannedToolCalls
        .map((call) => {
          const matchedTool = toolMap.get(call.toolName);
          if (!matchedTool) {
            return undefined;
          }

          return {
            toolName: matchedTool.name,
            permission: matchedTool.permission,
            args: call.args,
            reason: call.reason,
          } satisfies PlannedToolCall;
        })
        .filter((call): call is PlannedToolCall => call !== undefined);

      return {
        plannedToolCalls: plannedToolCalls.length > 0
          ? plannedToolCalls
          : [
              buildPlannedToolCall(
                "list_files",
                "low",
                { path: "." },
                "Fallback to a safe default because the model returned no valid tool calls.",
              ),
            ],
        finalAnswerPrompt: object.finalAnswerPrompt,
      };
    },
  };
}

export interface RunnerProviderEnv {
  AI_GATEWAY_API_KEY?: string;
  AI_GATEWAY_MODEL?: string;
  CATNIP_RUNNER_PROVIDER?: string;
}

export function createRunnerProviderFromEnv(env: RunnerProviderEnv = process.env): RunnerProvider {
  const mode = env.CATNIP_RUNNER_PROVIDER ?? "auto";
  const hasGatewayKey = typeof env.AI_GATEWAY_API_KEY === "string" && env.AI_GATEWAY_API_KEY.length > 0;
  const aiSdkOptions =
    typeof env.AI_GATEWAY_MODEL === "string" && env.AI_GATEWAY_MODEL.length > 0
      ? { model: env.AI_GATEWAY_MODEL }
      : {};

  if (mode === "heuristic") {
    return createHeuristicRunnerProvider();
  }

  if (mode === "ai-sdk") {
    if (!hasGatewayKey) {
      throw new Error("CATNIP_RUNNER_PROVIDER=ai-sdk requires AI_GATEWAY_API_KEY.");
    }

    return createAiSdkRunnerProvider(aiSdkOptions);
  }

  if (hasGatewayKey) {
    return createAiSdkRunnerProvider(aiSdkOptions);
  }

  return createHeuristicRunnerProvider();
}
