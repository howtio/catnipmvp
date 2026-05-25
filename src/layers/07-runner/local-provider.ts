import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { platform } from "node:process";
import type { MemoryEnrichedRunContext } from "../06.5-memory/index.js";
import type { PermissionLevel } from "../../shared/types/permission.js";
import type {
  RunnerProvider,
  AvailableTool,
  PlannedToolCall,
  RunnerStepPlan,
} from "./provider.js";

const IS_WINDOWS = platform === "win32";
const PLATFORM_HINT = IS_WINDOWS
  ? "This agent runs on Windows. Use Windows paths (backslash separators). Workspace root is the project directory. HTML preview files MUST be written under workspaces/demo/ relative to the project root. Use 'dir' instead of 'ls', 'type' instead of 'cat'. Git commands require Git for Windows on PATH."
  : "This agent runs on Unix-like system.";

const OLLAMA_DEFAULT_HOST = "http://localhost:11434";

export interface LocalRunnerProviderOptions {
  model?: string;
  host?: string;
  ollamaBinaryPath?: string;
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
    case "open_browser":
      return {
        path:
          typeof args.path === "string" && args.path.length > 0
            ? args.path
            : "workspaces/demo/generated.html",
      };
    case "web_search":
      return {
        query:
          typeof args.query === "string" && args.query.trim().length > 0
            ? args.query.trim()
            : "catnip agent",
        limit:
          typeof args.limit === "number" && Number.isInteger(args.limit)
            ? Math.max(1, Math.min(10, args.limit))
            : 5,
      };
    case "open_browser_search":
      return {
        query:
          typeof args.query === "string" && args.query.trim().length > 0
            ? args.query.trim()
            : "catnip agent",
      };
    case "open_url":
      return {
        url:
          typeof args.url === "string" && args.url.trim().length > 0
            ? args.url.trim()
            : "https://example.com/",
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

function buildWorkingMemoryPrompt(context: MemoryEnrichedRunContext): string {
  const workingSet = context.memory.workingSet;

  return [
    "Current working memory:",
    `- Focused file: ${workingSet.focusedFilePath ?? "none"}`,
    `- Focused openable HTML: ${workingSet.focusedOpenableHtmlPath ?? "none"}`,
    `- Openable HTML artifacts: ${workingSet.openableHtmlPaths.join(", ") || "none"}`,
    `- Recent files: ${workingSet.recentFilePaths.join(", ") || "none"}`,
    "When the user refers to 'this game', 'this page', 'this file', '这个游戏', '这个页面', '这个文件' or 'open it', resolve that reference to the focused artifact before scanning the workspace.",
    "Avoid listing directories just to rediscover an artifact that working memory already identifies.",
  ].join("\n");
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

async function checkOllamaRunning(host: string): Promise<boolean> {
  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function pullOllamaModel(host: string, model: string): Promise<void> {
  console.log(`[local] pulling model ${model} from Ollama...`);
  const response = await fetch(`${host}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: false }),
    signal: AbortSignal.timeout(600_000), // 10 min timeout for model download
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Ollama pull failed for ${model}: ${response.status} ${errorText}`);
  }

  console.log(`[local] model ${model} pulled successfully`);
}

export function createLocalRunnerProvider(options: LocalRunnerProviderOptions = {}): RunnerProvider {
  const host = options.host ?? process.env.CATNIP_LOCAL_HOST ?? OLLAMA_DEFAULT_HOST;
  const model = options.model ?? process.env.CATNIP_LOCAL_MODEL ?? "deepseek-r1:1.5b";
  let modelReady = false;

  const olp = createOpenAI({
    baseURL: `${host}/v1`,
    apiKey: "", // Ollama does not require an API key
  });

  const llm = olp(model);

  const ensureModel = async (): Promise<void> => {
    if (modelReady) return;

    const running = await checkOllamaRunning(host);
    if (!running) {
      throw new Error(
        `Ollama is not running at ${host}. ` +
        `Please start Ollama first:\n` +
        `  1. Download from https://ollama.com\n` +
        `  2. Run: ollama serve\n` +
        `  3. Then pull the model: ollama pull ${model}\n` +
        `  Or set CATNIP_LOCAL_HOST to a running Ollama instance.`
      );
    }

    // Check if model is available
    const tagsResponse = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const tags = await tagsResponse.json() as { models?: Array<{ name: string }> };
    const models = tags.models ?? [];
    const modelAvailable = models.some((m: { name: string }) => m.name.startsWith(model));

    if (!modelAvailable) {
      console.log(`[local] model ${model} not found locally, pulling...`);
      await pullOllamaModel(host, model);
    }

    modelReady = true;
  };

  return {
    async plan(context: MemoryEnrichedRunContext, availableTools: AvailableTool[]): Promise<RunnerStepPlan> {
      await ensureModel();

      const toolList = availableTools
        .map((tool) => `- ${tool.name} (${tool.permission}): ${tool.description}`)
        .join("\n");

      const prompt = [
        "You are planning tool usage for a coding agent runtime.",
        PLATFORM_HINT,
        `You are running locally with model: ${model}`,
        "Return only tool calls that exist in the allowed tool list.",
        "Prefer the minimum number of tool calls needed to answer the task.",
        "Write generated preview artifacts under workspaces/demo unless the user explicitly names another workspace path.",
        "open_browser only accepts html files inside workspaces/demo.",
        "If the user wants to click through a search result or open a webpage, use open_url with an http or https result URL.",
        buildWorkingMemoryPrompt(context),
        `Task: ${context.task.input}`,
        `Allowed tools:\n${toolList}`,
        `Workspace root: ${context.workspace.root}`,
      ].join("\n\n");

      const { object } = await generateObject({
        model: llm,
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
