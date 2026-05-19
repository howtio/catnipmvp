import { createId } from "../../shared/utils/createId.js";
import type { RunTask } from "../../shared/types/runTask.js";
import type { GatewayLayerApi, GatewayLayerDeps } from "./types.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

interface ParsedCliArgs {
  showHelp: boolean;
  interactive: boolean;
  inputText?: string;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const positionals: string[] = [];
  let showHelp = false;
  let interactive = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }

    if (arg === "--interactive" || arg === "-i") {
      interactive = true;
      continue;
    }

    positionals.push(arg);
  }

  const inputText = positionals.join(" ").trim();

  return {
    showHelp,
    interactive,
    ...(inputText.length > 0 ? { inputText } : {}),
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
  console.log("  echo \"your task\" | node dist/src/main.js");
  console.log("");
  console.log("Interactive commands:");
  console.log("  /help  Show this help");
  console.log("  /exit  Exit the CLI");
}

export function createGatewayLayer(deps: GatewayLayerDeps): GatewayLayerApi {
  async function runTaskInput(taskInput: string, sessionId: string): Promise<void> {
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
      return;
    }

    console.log(`[gateway] task ${task.id} completed`);
    if (result.task.runId) {
      console.log(`[gateway] runId: ${result.task.runId}`);
    }
    if (typeof result.task.stepsUsed === "number") {
      console.log(`[gateway] steps: ${result.task.stepsUsed}`);
    }
    if (typeof result.task.toolSummaryCount === "number") {
      console.log(`[gateway] tool summaries: ${result.task.toolSummaryCount}`);
    }
    if (typeof durationMs === "number") {
      console.log(`[gateway] durationMs: ${durationMs}`);
    }
    if (result.task.finalAnswer) {
      console.log("");
      console.log("Final answer:");
      console.log(result.task.finalAnswer);
    }
  }

  async function startInteractiveCli(): Promise<void> {
    const sessionId = createId("session");
    const rl = createInterface({ input, output });

    console.log("Catnip interactive CLI");
    console.log("Type your task and press Enter. Use /help or /exit.");

    try {
      for (;;) {
        const line = (await rl.question("catnip> ")).trim();
        if (line.length === 0) {
          continue;
        }

        if (line === "/exit" || line === "/quit") {
          break;
        }

        if (line === "/help") {
          printHelp();
          continue;
        }

        await runTaskInput(line, sessionId);
      }
    } finally {
      rl.close();
    }
  }

  return {
    async startCli(): Promise<void> {
      const parsed = parseCliArgs(process.argv.slice(2));
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
    },
  };
}
