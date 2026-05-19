import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject, generateText, stepCountIs, tool as defineTool } from "ai";
import { z } from "zod";
import type { EnrichedRunContext } from "../06-skills/index.js";
import type { PermissionLevel } from "../../shared/types/permission.js";
import { buildFinalAnswer } from "./planner.js";
import type { RunnerRunResult, ToolExecutionSummary } from "./planner.js";

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
  runWithTools?(
    context: EnrichedRunContext,
    availableTools: AvailableTool[],
    helpers: {
      executeToolCall(plannedCall: PlannedToolCall): Promise<ToolExecutionSummary>;
      onStepFinish(event: { stepNumber: number; toolCalls: number; toolResults: number; text: string }): void;
      maxSteps: number;
    },
  ): Promise<RunnerRunResult>;
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

function summarizeAiSdkToolResult(toolResult: { toolName: string; output: unknown }): ToolExecutionSummary {
  return {
    toolName: toolResult.toolName,
    ok: true,
    reason: "Model-selected tool call.",
    result: toolResult.output,
  };
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
  const toolMap = new Map<string, AvailableTool>();

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
    async runWithTools(context: EnrichedRunContext, availableTools: AvailableTool[], helpers) {
      toolMap.clear();
      const toolSummaries: ToolExecutionSummary[] = [];
      for (const tool of availableTools) {
        toolMap.set(tool.name, tool);
      }

      const result = await generateText({
        model: provider(model),
        system: [
          context.systemPrompt,
          "Use the available tools when they materially help solve the task.",
          "Do not invent tool names or parameters outside the schemas.",
        ].join("\n\n"),
        prompt: context.task.input,
        stopWhen: stepCountIs(helpers.maxSteps),
        tools: {
          list_files: defineTool({
            description: "List files inside the workspace.",
            inputSchema: z.object({
              path: z.string().default(".").describe("Relative path inside the workspace."),
            }),
            execute: async (input) => {
              const availableTool = toolMap.get("list_files");
              if (!availableTool) {
                throw new Error("Tool registry is missing list_files.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "list_files",
                permission: availableTool.permission,
                args: normalizePlannedToolArgs("list_files", input),
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "list_files failed");
              }
              return summary.result;
            },
          }),
          read_file: defineTool({
            description: "Read a file inside the workspace.",
            inputSchema: z.object({
              path: z.string().describe("Relative path inside the workspace."),
            }),
            execute: async (input) => {
              const availableTool = toolMap.get("read_file");
              if (!availableTool) {
                throw new Error("Tool registry is missing read_file.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "read_file",
                permission: availableTool.permission,
                args: normalizePlannedToolArgs("read_file", input),
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "read_file failed");
              }
              return summary.result;
            },
          }),
          write_file: defineTool({
            description: "Write a file inside the workspace.",
            inputSchema: z.object({
              path: z.string().describe("Relative path inside the workspace."),
              content: z.string().describe("UTF-8 text content to write."),
            }),
            execute: async (input) => {
              const availableTool = toolMap.get("write_file");
              if (!availableTool) {
                throw new Error("Tool registry is missing write_file.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "write_file",
                permission: availableTool.permission,
                args: normalizePlannedToolArgs("write_file", input),
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "write_file failed");
              }
              return summary.result;
            },
          }),
          patch_file: defineTool({
            description: "Replace text inside a workspace file.",
            inputSchema: z.object({
              path: z.string().describe("Relative path inside the workspace."),
              search: z.string().describe("Text to find."),
              replace: z.string().describe("Replacement text."),
            }),
            execute: async (input) => {
              const availableTool = toolMap.get("patch_file");
              if (!availableTool) {
                throw new Error("Tool registry is missing patch_file.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "patch_file",
                permission: availableTool.permission,
                args: normalizePlannedToolArgs("patch_file", input),
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "patch_file failed");
              }
              return summary.result;
            },
          }),
          shell_exec: defineTool({
            description: "Run a whitelisted shell command inside the workspace.",
            inputSchema: z.object({
              command: z.string().describe("Whitelisted command name."),
              argv: z.array(z.string()).default([]).describe("Argument array."),
            }),
            execute: async (input) => {
              const availableTool = toolMap.get("shell_exec");
              if (!availableTool) {
                throw new Error("Tool registry is missing shell_exec.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "shell_exec",
                permission: availableTool.permission,
                args: normalizePlannedToolArgs("shell_exec", input),
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "shell_exec failed");
              }
              return summary.result;
            },
          }),
          git_diff: defineTool({
            description: "Inspect the current git diff.",
            inputSchema: z.object({}),
            execute: async () => {
              const availableTool = toolMap.get("git_diff");
              if (!availableTool) {
                throw new Error("Tool registry is missing git_diff.");
              }
              const summary = await helpers.executeToolCall({
                toolName: "git_diff",
                permission: availableTool.permission,
                args: {},
                reason: "Model-selected tool call.",
              });
              toolSummaries.push(summary);
              if (!summary.ok) {
                throw new Error(summary.error ?? "git_diff failed");
              }
              return summary.result;
            },
          }),
        },
        onStepFinish(event) {
          helpers.onStepFinish({
            stepNumber: event.stepNumber,
            toolCalls: event.toolCalls.length,
            toolResults: event.toolResults.length,
            text: event.text,
          });
        },
      });

      const finalAnswer = result.text && result.text.trim().length > 0
        ? result.text
        : buildFinalAnswer(toolSummaries.length > 0 ? toolSummaries : result.toolResults.map((toolResult) =>
            summarizeAiSdkToolResult({
              toolName: toolResult.toolName,
              output: toolResult.output,
            }),
          ));

      return {
        stepsUsed: result.steps.length,
        finalAnswer,
        toolSummaries,
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
