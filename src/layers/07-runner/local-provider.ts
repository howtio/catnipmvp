import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
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

/** Check if the model produced no meaningful tool calls — either empty or all-defaults. */
function modelProducedNoMeaningfulCalls(plannedCalls: PlannedToolCall[]): boolean {
  if (plannedCalls.length === 0) return true;
  return plannedCalls.every((call) => {
    const defaultArgs = normalizePlannedToolArgs(call.toolName, {});
    return JSON.stringify(call.args) === JSON.stringify(defaultArgs);
  });
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
  finalAnswerPrompt: z.string().describe("The final answer to the user's task. If no tools were needed, answer the question directly here. This is what the user will see as the result."),
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

function generateFileContent(ext: string, task: string, modelDescription: string): string {
  const isHelloWorld = /hello\s*world|你好|示例|sample|example/i.test(task);
  const isPython = ext === "py";
  const isHtml = ext === "html" || ext === "htm";
  const isJs = ext === "js";

  if (isPython && isHelloWorld) {
    return `# Generated by Catnip Agent\nprint("Hello, World!")\n`;
  }
  if (isPython) {
    return `# ${modelDescription}\n# TODO: implement\nprint("Hello from Catnip!")\n`;
  }
  if (isHtml && isHelloWorld) {
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>Hello</title></head><body><h1>你好世界</h1></body></html>\n`;
  }
  if (isHtml) {
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>Generated</title></head><body><h1>Generated by Catnip</h1><p>${modelDescription}</p></body></html>\n`;
  }
  if (isJs && isHelloWorld) {
    return `// Generated by Catnip Agent\nconsole.log("Hello, World!");\n`;
  }
  return `# Generated by Catnip Agent\n# ${modelDescription}\n`;
}

function guessFileExtension(task: string): string {
  const extMatch = task.match(/\.(\w+)/);
  if (extMatch && extMatch[1]) return extMatch[1];
  const langMatch = task.match(/python|javascript|typescript|html|css|java|cpp|rust|go|bash|shell|ruby|php/i);
  if (langMatch) {
    const extMap: Record<string, string> = { python: "py", javascript: "js", typescript: "ts", html: "html", css: "css", java: "java", cpp: "cpp", rust: "rs", go: "go", bash: "sh", shell: "sh", ruby: "rb", php: "php" };
    return extMap[langMatch[0].toLowerCase()] ?? "txt";
  }
  return "txt";
}

function guessFileName(task: string, ext: string): string {
  const nameMatch = task.match(/(?:叫|名为|name[d]?\s*:?\s*|文件名\s*:?\s*)?(\w+\.\w+)/i);
  if (nameMatch && nameMatch[1]) return nameMatch[1];
  return `task_output.${ext}`;
}

async function generateContent(
  model: Parameters<typeof generateText>[0]["model"],
  task: string,
  ext: string,
): Promise<string> {
  const isCode = ["py", "js", "ts", "java", "cpp", "rs", "go", "sh", "rb", "php", "css"].includes(ext);

  const systemPrompt = isCode
    ? "You are a code generator. Output ONLY the source code with no explanation, no markdown formatting, no backticks. Just raw code."
    : "You are a content writer. Output ONLY the requested content with no explanation, no meta-commentary. Just the raw text.";

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: task,
  });

  // Strip markdown code fences that small models often add despite instructions
  return text.trim()
    .replace(/^```\w*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export function createLocalRunnerProvider(options: LocalRunnerProviderOptions = {}): RunnerProvider {
  const host = options.host ?? process.env.CATNIP_LOCAL_HOST ?? OLLAMA_DEFAULT_HOST;
  const model = options.model ?? process.env.CATNIP_LOCAL_MODEL ?? "qwen2.5:1.5b";
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
        "You are a coding agent that MUST use tools to take action.",
        PLATFORM_HINT,
        `You are running locally with model: ${model}`,
        "",
        "## RULES",
        "- NEVER say you will do something without actually using a tool.",
        "- If the user asks to write/create/make/run something → USE write_file or shell_exec. Do NOT just answer in words.",
        "- If the user greets you or asks a general question → return empty plannedToolCalls, answer in finalAnswerPrompt.",
        "",
        "## Examples",
        '- User: "帮我写个python hello world" → write_file(path="workspaces/demo/hello.py", content="print(\'hello world\')")',
        '- User: "你是谁" → empty tools, finalAnswerPrompt="我是 Catnip Agent"',
        '- User: "现在几点" → empty tools, finalAnswerPrompt="请查看系统时钟"',
        "- User: '列出文件' → list_files(path='.')",
        "",
        "## finalAnswerPrompt",
        "This is shown to the user as the response. If you used tools, mention what was done.",
        "",
        "Write preview files under workspaces/demo.",
        "open_browser only works with .html files in workspaces/demo.",
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

      // 1.5B local model cannot reliably plan tools. Use heuristic for known task patterns.
      const task = context.task.input;
      const trimmedTask = task.trim();

      // Greeting / identity check: answer directly without tools.
      // 1.5B models tend to plan read_file or shell_exec for simple Q&A, so intercept early.
      // Also override identity answers since small models introduce themselves as Qwen.
      if (
        /^(你好|hello\b|hi\b|hey\b|您好)\b/i.test(trimmedTask) ||
        /你是谁|你叫什么|你是什么|who are you|what are you/i.test(task)
      ) {
        return {
          plannedToolCalls: [],
          finalAnswerPrompt: /你是谁|你叫什么|你是什么|who are you|what are you/i.test(task)
            ? "我是 Catnip Agent，一个基于本地模型的 AI 助手。有什么可以帮助你的吗？"
            : object.finalAnswerPrompt,
        };
      }

      const toolDef = (name: string) => availableTools.find((t) => t.name === name);

      // Build a tool call with validation
      const call = (name: string, args: Record<string, unknown>, reason: string): PlannedToolCall | undefined => {
        const def = toolDef(name);
        return def ? { toolName: name, permission: def.permission, args, reason } : undefined;
      };

      // Detect browser intent: "打开" / "预览" / "preview" (also catches standalone "打开" at end like "写html然后打开")
      const hasOpenIntent = /打开|预览|preview/i.test(task);

      // Heuristic dispatch: check task against known patterns in priority order
      const writeTask = /写|创建|create|make|generate|编写|产生|code|代码|script|脚本|生成/i.test(task);
      const openBrowserTask = /打开.*浏览器|open.*browser|浏览器|预览/i.test(task) || (hasOpenIntent && !writeTask);
      const shellTask = /运行|run|执行|execute|install|编译|build|npm|git/i.test(task);
      const searchTask = /搜索|search|查找|query|搜/i.test(task);
      const openUrlTask = /打开.*链接|open.*url|访问.*网站|visit/i.test(task);
      const readFileTask = /readme|read.*file|显示|查看/i.test(task) && !writeTask;
      const diffTask = /git diff|diff.*git|差异|对比/i.test(task);
      const listTask = /列出|list.*file|目录|dir|文件夹/i.test(task);

      // Collect all matching heuristic tool calls
      const heuristicCalls: PlannedToolCall[] = [];

      if (writeTask) {
        const ext = guessFileExtension(task);
        const fileName = guessFileName(task, ext);
        const path = fileName.startsWith("workspaces/") ? fileName : `workspaces/demo/${fileName}`;

        // Use the local model to generate real content instead of templates.
        // The 1.5B model is unreliable at planning tool calls but can generate text/code well.
        let content: string;
        try {
          content = await generateContent(llm, task, ext);
        } catch {
          content = generateFileContent(ext, task, object.finalAnswerPrompt);
        }

        const c = call("write_file", { path, content }, `Write ${fileName} as requested`);
        if (c) heuristicCalls.push(c);

        // If writeTask generates an HTML file and user also wants to open/preview it,
        // add open_browser with the SAME path to fix the path mismatch.
        if (ext === "html" && hasOpenIntent) {
          const bc = call("open_browser", { path }, `Open ${fileName} in browser after writing.`);
          if (bc) heuristicCalls.push(bc);
        }
      }

      if (openBrowserTask && !writeTask) {
        const focused = context.memory.workingSet.focusedOpenableHtmlPath
          ?? context.memory.workingSet.openableHtmlPaths[0]
          ?? "workspaces/demo/generated.html";
        const c = call("open_browser", { path: focused }, focused !== "workspaces/demo/generated.html"
          ? "Open the focused HTML artifact from working memory."
          : "Open browser for preview.");
        if (c) heuristicCalls.push(c);
      }

      if (shellTask) {
        const c = call("shell_exec", { command: "git", argv: ["status"] }, "Run shell command as requested.");
        if (c) heuristicCalls.push(c);
      }

      if (searchTask) {
        const query = task.replace(/搜索|search|query|查找|搜/gi, "").trim() || task;
        const c = call("web_search", { query, limit: 5 }, "Search the web.");
        if (c) heuristicCalls.push(c);
      }

      if (openUrlTask) {
        const url = task.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? "https://example.com/";
        const c = call("open_url", { url }, "Open the requested URL.");
        if (c) heuristicCalls.push(c);
      }

      if (readFileTask) {
        const c = call("read_file", { path: "README.md" }, "Read the project readme.");
        if (c) heuristicCalls.push(c);
      }

      if (diffTask) {
        const c = call("git_diff", {}, "Inspect current git diff.");
        if (c) heuristicCalls.push(c);
      }

      if (listTask) {
        const c = call("list_files", { path: "." }, "List workspace entries.");
        if (c) heuristicCalls.push(c);
      }

      // If any heuristic pattern matched, use it (model's plan is unreliable)
      if (heuristicCalls.length > 0) {
        return {
          plannedToolCalls: heuristicCalls,
          finalAnswerPrompt: object.finalAnswerPrompt,
        };
      }

      // For Q&A / info tasks: if model returned empty or default-only calls, answer directly
      if (modelProducedNoMeaningfulCalls(plannedToolCalls)) {
        return {
          plannedToolCalls: [],
          finalAnswerPrompt: object.finalAnswerPrompt,
        };
      }

      return {
        plannedToolCalls,
        finalAnswerPrompt: object.finalAnswerPrompt,
      };
    },

  };
}
