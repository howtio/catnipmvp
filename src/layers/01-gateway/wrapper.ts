import { createId } from "../../shared/utils/createId.js";
import type { RunTask } from "../../shared/types/runTask.js";
import type { GatewayLayerApi, GatewayLayerDeps } from "./types.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { EventBusEvent } from "../08-eventbus/index.js";

interface ParsedCliArgs {
  showHelp: boolean;
  interactive: boolean;
  debug: boolean;
  inputText?: string;
}

interface CliRunResult {
  taskId: string;
  runId?: string;
  finalAnswer?: string;
  stepsUsed?: number;
  toolSummaryCount?: number;
  durationMs?: number;
}

interface InteractiveCommand {
  type: "help" | "exit" | "history" | "last" | "clear" | "task";
  taskInput?: string;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const positionals: string[] = [];
  let showHelp = false;
  let interactive = false;
  let debug = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }

    if (arg === "--interactive" || arg === "-i") {
      interactive = true;
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    positionals.push(arg);
  }

  const inputText = positionals.join(" ").trim();

  return {
    showHelp,
    interactive,
    debug,
    ...(inputText.length > 0 ? { inputText } : {}),
  };
}

export function parseInteractiveCommand(line: string): InteractiveCommand {
  const trimmed = line.trim();

  if (trimmed === "/help") {
    return { type: "help" };
  }

  if (trimmed === "/exit" || trimmed === "/quit") {
    return { type: "exit" };
  }

  if (trimmed === "/history") {
    return { type: "history" };
  }

  if (trimmed === "/last") {
    return { type: "last" };
  }

  if (trimmed === "/clear") {
    return { type: "clear" };
  }

  return {
    type: "task",
    taskInput: trimmed,
  };
}

async function readStdinText(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of input) {
    chunks.push(String(chunk));
  }

  return chunks.join("").trim();
}

function formatDurationMs(task: RunTask): number | undefined {
  if (!task.startedAt || !task.finishedAt) {
    return undefined;
  }

  const startedAt = Date.parse(task.startedAt);
  const finishedAt = Date.parse(task.finishedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) {
    return undefined;
  }

  return Math.max(0, finishedAt - startedAt);
}

function printHelp(): void {
  console.log("Catnip Agent CLI");
  console.log("Usage:");
  console.log('  node dist/src/main.js "your task"');
  console.log("  node dist/src/main.js --interactive");
  console.log("  node dist/src/main.js --debug \"your task\"");
  console.log("  echo \"your task\" | node dist/src/main.js");
  console.log("");
  console.log("Interactive commands:");
  console.log("  /help  Show this help");
  console.log("  /history  Show tasks from this interactive session");
  console.log("  /last  Show the last final answer again");
  console.log("  /clear  Clear session history");
  console.log("  /exit  Exit the CLI");
}

function formatDebugPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readEventField(event: EventBusEvent, fieldName: string): unknown {
  if (!isRecord(event)) {
    return undefined;
  }

  return (event as Record<string, unknown>)[fieldName];
}

function setupDebugOutput(deps: GatewayLayerDeps): () => void {
  if (!deps.eventbus) {
    return () => {};
  }

  const unsubscribers = [
    deps.eventbus.subscribe("prompt.composed", (event) => {
      console.log("");
      console.log("[debug] prompt.composed");
      console.log(`[debug] task: ${formatDebugPayload(readEventField(event, "taskInput"))}`);
      console.log(`[debug] systemPrompt: ${formatDebugPayload(readEventField(event, "systemPrompt"))}`);
      console.log(
        `[debug] skillInstructions: ${formatDebugPayload(readEventField(event, "skillInstructions"))}`,
      );
      console.log(`[debug] selectedSkills: ${formatDebugPayload(readEventField(event, "selectedSkills"))}`);
      console.log(`[debug] loadedDocuments: ${formatDebugPayload(readEventField(event, "loadedDocuments"))}`);
    }),
    deps.eventbus.subscribe("agent.plan.generated", (event) => {
      console.log("");
      console.log(`[debug] agent.plan.generated mode=${formatDebugPayload(readEventField(event, "mode"))}`);
      console.log(
        `[debug] plannedToolCalls: ${formatDebugPayload(readEventField(event, "plannedToolCalls"))}`,
      );
      const finalAnswerPrompt = readEventField(event, "finalAnswerPrompt");
      if (finalAnswerPrompt !== undefined) {
        console.log(`[debug] finalAnswerPrompt: ${formatDebugPayload(finalAnswerPrompt)}`);
      }
    }),
    deps.eventbus.subscribe("agent.reasoning.summary", (event) => {
      console.log(
        `[debug] step=${formatDebugPayload(readEventField(event, "stepNumber"))} summary=${formatDebugPayload(readEventField(event, "summary"))}`,
      );
    }),
    deps.eventbus.subscribe("tool.call.requested", (event) => {
      console.log(
        `[debug] tool.request tool=${formatDebugPayload(readEventField(event, "toolName"))} args=${formatDebugPayload(readEventField(event, "args"))}`,
      );
    }),
    deps.eventbus.subscribe("tool.call.result", (event) => {
      console.log(
        `[debug] tool.result ok=${formatDebugPayload(readEventField(event, "ok"))} result=${formatDebugPayload(readEventField(event, "result"))}`,
      );
    }),
    deps.eventbus.subscribe("tool.call.failed", (event) => {
      console.log(`[debug] tool.failed error=${formatDebugPayload(readEventField(event, "error"))}`);
    }),
    deps.eventbus.subscribe("agent.answer.produced", (event) => {
      console.log("");
      console.log(`[debug] finalAnswer: ${formatDebugPayload(readEventField(event, "answer"))}`);
    }),
  ];

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

function printRunResult(result: CliRunResult): void {
  if (result.runId) {
    console.log(`[gateway] runId: ${result.runId}`);
  }
  if (typeof result.stepsUsed === "number") {
    console.log(`[gateway] steps: ${result.stepsUsed}`);
  }
  if (typeof result.toolSummaryCount === "number") {
    console.log(`[gateway] tool summaries: ${result.toolSummaryCount}`);
  }
  if (typeof result.durationMs === "number") {
    console.log(`[gateway] durationMs: ${result.durationMs}`);
  }
  if (result.finalAnswer) {
    console.log("");
    console.log("Final answer:");
    console.log(result.finalAnswer);
  }
}

function printHistory(history: CliRunResult[]): void {
  if (history.length === 0) {
    console.log("[gateway] no interactive session history yet");
    return;
  }

  console.log("[gateway] interactive session history");
  for (const [index, entry] of history.entries()) {
    const answerPreview = entry.finalAnswer
      ? entry.finalAnswer.replace(/\s+/g, " ").slice(0, 80)
      : "no final answer";
    const suffix = answerPreview.length === 80 ? "..." : "";
    console.log(
      `${index + 1}. task=${entry.taskId} run=${entry.runId ?? "n/a"} steps=${entry.stepsUsed ?? 0} answer=${answerPreview}${suffix}`,
    );
  }
}

function buildCliRunResult(taskId: string, fields: Omit<CliRunResult, "taskId"> = {}): CliRunResult {
  return {
    taskId,
    ...fields,
  };
}

export function createGatewayLayer(deps: GatewayLayerDeps): GatewayLayerApi {
  async function runTaskInput(taskInput: string, sessionId: string): Promise<CliRunResult> {
    const task: RunTask = {
      id: createId("task"),
      sessionId,
      input: taskInput,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await deps.queue.enqueue(task);
    console.log(`[gateway] queued task ${task.id}`);

    const result = await deps.queue.waitForCompletion(task.id);
    const durationMs = formatDurationMs(result.task);
    if (result.status === "failed") {
      console.error(`[gateway] task ${task.id} failed: ${result.task.errorMessage ?? "unknown error"}`);
      process.exitCode = 1;
      return buildCliRunResult(task.id, typeof durationMs === "number" ? { durationMs } : {});
    }

    console.log(`[gateway] task ${task.id} completed`);
    const cliRunResult = buildCliRunResult(task.id, {
      ...(result.task.runId ? { runId: result.task.runId } : {}),
      ...(result.task.finalAnswer ? { finalAnswer: result.task.finalAnswer } : {}),
      ...(typeof result.task.stepsUsed === "number" ? { stepsUsed: result.task.stepsUsed } : {}),
      ...(typeof result.task.toolSummaryCount === "number"
        ? { toolSummaryCount: result.task.toolSummaryCount }
        : {}),
      ...(typeof durationMs === "number" ? { durationMs } : {}),
    });
    printRunResult(cliRunResult);
    return cliRunResult;
  }

  async function startInteractiveCli(): Promise<void> {
    const sessionId = createId("session");
    const rl = createInterface({ input, output });
    const history: CliRunResult[] = [];

    console.log("Catnip interactive CLI");
    console.log("Type your task and press Enter. Use /help, /history, /last, /clear or /exit.");

    try {
      for (;;) {
        let line: string;
        try {
          line = (await rl.question("catnip> ")).trim();
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ERR_USE_AFTER_CLOSE"
          ) {
            break;
          }

          throw error;
        }
        if (line.length === 0) {
          continue;
        }

        const command = parseInteractiveCommand(line);
        if (command.type === "exit") {
          break;
        }

        if (command.type === "help") {
          printHelp();
          continue;
        }

        if (command.type === "history") {
          printHistory(history);
          continue;
        }

        if (command.type === "last") {
          const lastResult = history.at(-1);
          if (!lastResult) {
            console.log("[gateway] no previous result in this interactive session");
            continue;
          }
          printRunResult(lastResult);
          continue;
        }

        if (command.type === "clear") {
          history.length = 0;
          console.log("[gateway] cleared interactive session history");
          continue;
        }

        if (command.type === "task") {
          const cliRunResult = await runTaskInput(command.taskInput ?? "", sessionId);
          history.push(cliRunResult);
        }
      }
    } finally {
      rl.close();
    }
  }

  return {
    async startCli(): Promise<void> {
      const parsed = parseCliArgs(process.argv.slice(2));
      const debugEnabled = parsed.debug || process.env.CATNIP_CLI_DEBUG === "1";
      const teardownDebugOutput = debugEnabled ? setupDebugOutput(deps) : () => {};
      if (debugEnabled) {
        console.log("[gateway] debug output enabled");
        console.log("[gateway] trace log file: logs/catnip-trace.jsonl");
      }
      try {
      if (parsed.showHelp) {
        printHelp();
        return;
      }

      if (parsed.inputText) {
        await runTaskInput(parsed.inputText, createId("session"));
        return;
      }

      if (parsed.interactive || process.stdin.isTTY) {
        await startInteractiveCli();
        return;
      }

      const stdinText = await readStdinText();
      if (stdinText.length === 0) {
        console.error("[gateway] no task input provided");
        process.exitCode = 1;
        return;
      }

      await runTaskInput(stdinText, createId("session"));
      } finally {
        teardownDebugOutput();
      }
    },
  };
}
