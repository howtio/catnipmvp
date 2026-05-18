import { createDeepSeek } from "@ai-sdk/deepseek";
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

function normalizePlannedToolArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  switch (toolName) {
    case "list_files":
      return {
        path: typeof args.path === "string" && args.path.length > 0 ? args.path : ".",
      };
    case "read_file":
      return {
        path: typeof args.path === "string" && args.path.length > 0 ? args.path : "README.md",
      };
    case "write_file":
      return {
        path:
          typeof args.path === "string" && args.path.length > 0
            ? args.path
            : "workspaces/demo/generated.txt",
        content:
          typeof args.content === "string" ? args.content : "Generated from model plan.\n",
      };
    case "patch_file":
      return {
        path:
          typeof args.path === "string" && args.path.length > 0
            ? args.path
            : "workspaces/demo/generated.txt",
        search: typeof args.search === "string" && args.search.length > 0 ? args.search : "Generated",
        replace: typeof args.replace === "string" ? args.replace : "Patched",
      };
    case "shell_exec":
      return {
        command: typeof args.command === "string" && args.command.length > 0 ? args.command : "git",
        argv:
          Array.isArray(args.argv) && args.argv.every((item) => typeof item === "string")
            ? args.argv
            : ["status"],
      };
    case "git_diff":
      return {};
    default:
      return args;
  }
}

function normalizePlannedCalls(
  rawCalls: Array<{ toolName: string; args: Record<string, unknown>; reason: string }>,
  availableTools: AvailableTool[],
): PlannedToolCall[] {
  const toolMap = new Map(availableTools.map((tool) => [tool.name, tool]));

  return rawCalls
    .map((call) => {
      const matchedTool = toolMap.get(call.toolName);
      if (!matchedTool) {
        return undefined;
      }

      return {
        toolName: matchedTool.name,
        permission: matchedTool.permission,
        args: normalizePlannedToolArgs(call.toolName, call.args),
        reason: call.reason,
      } satisfies PlannedToolCall;
    })
    .filter((call): call is PlannedToolCall => call !== undefined);
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

      const plannedToolCalls = normalizePlannedCalls(object.plannedToolCalls, availableTools);

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

export interface DeepSeekRunnerProviderOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
}

export function createDeepSeekRunnerProvider(options: DeepSeekRunnerProviderOptions = {}): RunnerProvider {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek runner provider requires DEEPSEEK_API_KEY.");
  }

  const resolvedBaseUrl = options.baseURL ?? process.env.DEEPSEEK_BASE_URL;
  const provider = createDeepSeek({
    apiKey,
    ...(typeof resolvedBaseUrl === "string" && resolvedBaseUrl.length > 0
      ? { baseURL: resolvedBaseUrl }
      : {}),
  });
  const model = options.model ?? "deepseek-chat";

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
        model: provider(model),
        schema: aiSdkPlanSchema,
        prompt,
      });

      const plannedToolCalls = normalizePlannedCalls(object.plannedToolCalls, availableTools);

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
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  CATNIP_RUNNER_PROVIDER?: string;
}

export function createRunnerProviderFromEnv(env: RunnerProviderEnv = process.env): RunnerProvider {
  const mode = env.CATNIP_RUNNER_PROVIDER ?? "auto";
  const hasGatewayKey = typeof env.AI_GATEWAY_API_KEY === "string" && env.AI_GATEWAY_API_KEY.length > 0;
  const hasDeepSeekKey = typeof env.DEEPSEEK_API_KEY === "string" && env.DEEPSEEK_API_KEY.length > 0;
  const aiSdkOptions =
    typeof env.AI_GATEWAY_MODEL === "string" && env.AI_GATEWAY_MODEL.length > 0
      ? { model: env.AI_GATEWAY_MODEL }
      : {};
  const deepSeekOptions = {
    ...(typeof env.DEEPSEEK_BASE_URL === "string" && env.DEEPSEEK_BASE_URL.length > 0
      ? { baseURL: env.DEEPSEEK_BASE_URL }
      : {}),
    ...(typeof env.DEEPSEEK_API_KEY === "string" && env.DEEPSEEK_API_KEY.length > 0
      ? { apiKey: env.DEEPSEEK_API_KEY }
      : {}),
  };

  if (mode === "heuristic") {
    return createHeuristicRunnerProvider();
  }

  if (mode === "deepseek") {
    if (!hasDeepSeekKey) {
      throw new Error("CATNIP_RUNNER_PROVIDER=deepseek requires DEEPSEEK_API_KEY.");
    }

    return createDeepSeekRunnerProvider(deepSeekOptions);
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

  if (hasDeepSeekKey) {
    return createDeepSeekRunnerProvider(deepSeekOptions);
  }

  return createHeuristicRunnerProvider();
}
