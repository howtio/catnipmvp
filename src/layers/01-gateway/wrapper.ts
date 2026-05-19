import { createId } from "../../shared/utils/createId.js";
import type { RunTask } from "../../shared/types/runTask.js";
import type { GatewayLayerApi, GatewayLayerDeps } from "./types.js";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import type { EventBusEvent } from "../08-eventbus/index.js";
import type { QueueTaskSnapshot } from "../02-queue/index.js";
import { sleep } from "../../shared/utils/sleep.js";

interface ParsedCliArgs {
  showHelp: boolean;
  interactive: boolean;
  debug: boolean;
  tasks: string[];
  tasksFilePath?: string;
}

interface CliRunResult {
  taskId: string;
  taskInput?: string;
  runId?: string;
  finalAnswer?: string;
  stepsUsed?: number;
  toolSummaryCount?: number;
  queueWaitMs?: number;
  totalDurationMs?: number;
  durationMs?: number;
  failureKind?: "timeout" | "runtime";
  errorMessage?: string;
  ok?: boolean;
}

interface InteractiveCommand {
  type: "help" | "exit" | "history" | "last" | "clear" | "task";
  taskInput?: string;
}

interface ActiveInteractiveTask {
  baseInput: string;
  ordinal: number;
  supplements: string[];
  completion: Promise<void>;
}

const FOLLOW_UP_ANSWER_PREVIEW_LIMIT = 1200;
const RUN_TIMER_INTERVAL_MS = 5000;
const PINK_ANSI = "\u001b[38;5;213m";
const GREEN_ANSI = "\u001b[32m";
const YELLOW_ANSI = "\u001b[33m";
const RESET_ANSI = "\u001b[0m";
const INTERACTIVE_PROMPT = "catnip> ";
const STARTUP_ANIMATION_FRAME_DELAY_MS = 70;

export function buildCliStartupArtLines(): string[] {
  return [
    "/\\_________________________/\\\\",
    "              __/  \\\\_______________________/  \\\\__",
    "            _/:::::::::::::::::::::::::::::::::::::\\\\_",
    "          _/:::::::::::::::::::::::::::::::::::::::::\\\\_",
    "         /:::::::::::::::::::::::::::::::::::::::::::::\\\\",
    "        /:::::::::::::::::::::::::::::::::::::::::::::::\\\\",
    "       |:::::::::::::::::::::::::::::::::::::::::::::::::|",
    "       |:::::::::::::::   o                 o   ::::::::|",
    "       |::::::::::::::::                           ::::::|",
    "       |::::::::::::::::           ___             ::::::|",
    "       |::::::::::::::::          \\\\___/            ::::::|",
    "       |:::::::::::::::::::::::::::::::::::::::::::::::::|",
    "        \\\\:::::::::::::::::::::::::::::::::::::::::::::::/",
    "         \\\\:::::::::::::::::::::::::::::::::::::::::::::/",
    "          \\\\_:::::::::::::::::::::::::::::::::::::::::_/",
    "            \\\\_______________________________________/",
    "",
    "              /\\\\ ",
    "         ____/  \\\\____",
    "        /::::::::::::\\\\",
    "       /::::::@@::::::\\\\",
    "       \\\\::::::@@::::::/",
    "        \\\\____::::____/",
    "             \\\\::/",
  ];
}

export function buildCliStartupFrames(): string[] {
  const lines = buildCliStartupArtLines();
  const cutPoints = [6, 12, 18, lines.length];

  return cutPoints.map((count) => `${PINK_ANSI}${lines.slice(0, count).join("\n")}\nWelcome to Catnip${RESET_ANSI}`);
}

export function buildCliStartupBanner(): string {
  const frames = buildCliStartupFrames();
  return frames.at(-1) ?? `${PINK_ANSI}Welcome to Catnip${RESET_ANSI}`;
}

export function getInteractivePrompt(): string {
  return INTERACTIVE_PROMPT;
}

function colorizeLine(color: string, line: string): string {
  return `${color}${line}${RESET_ANSI}`;
}

function colorizePink(line: string): string {
  return colorizeLine(PINK_ANSI, line);
}

function colorizeGreen(line: string): string {
  return colorizeLine(GREEN_ANSI, line);
}

function colorizeYellow(line: string): string {
  return colorizeLine(YELLOW_ANSI, line);
}

async function printCliStartupAnimation(): Promise<void> {
  const frames = buildCliStartupFrames();

  for (const frame of frames) {
    console.log(frame);
    if (frame !== frames.at(-1)) {
      await sleep(STARTUP_ANIMATION_FRAME_DELAY_MS);
    }
  }
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const positionals: string[] = [];
  const tasks: string[] = [];
  let showHelp = false;
  let interactive = false;
  let debug = false;
  let tasksFilePath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (typeof arg !== "string") {
      continue;
    }
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

    if (arg === "--task" || arg === "-t") {
      const value = argv[index + 1];
      if (typeof value === "string") {
        tasks.push(value.trim());
        index += 1;
      }
      continue;
    }

    if (arg === "--tasks-file") {
      const value = argv[index + 1];
      if (typeof value === "string") {
        tasksFilePath = value;
        index += 1;
      }
      continue;
    }

    positionals.push(arg);
  }

  const inputText = positionals.join(" ").trim();
  if (inputText.length > 0) {
    tasks.push(inputText);
  }

  return {
    showHelp,
    interactive,
    debug,
    tasks: tasks.filter((task) => task.length > 0),
    ...(tasksFilePath ? { tasksFilePath } : {}),
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

function parseTaskListText(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function readTasksFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, "utf8");
  return parseTaskListText(content);
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
  console.log('  node dist/src/main.js --task "task 1" --task "task 2"');
  console.log("  node dist/src/main.js --tasks-file tasks.txt");
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

function formatLayerStage(stage: string): string {
  if (stage.startsWith("context.")) {
    return "05-context";
  }

  if (stage.startsWith("skills.")) {
    return "06-skills";
  }

  if (stage.startsWith("runner.")) {
    return "07-runner";
  }

  return "04-harness";
}

interface TrackedCliTask {
  taskId: string;
  taskInput: string;
  ordinal: number;
  total?: number;
}

interface CliEventPrinter {
  trackTask(task: TrackedCliTask): void;
  teardown(): void;
}

function truncateText(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatElapsedSeconds(durationMs: number): string {
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

function formatWaitSeconds(durationMs: number): string {
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

export function formatRunTimerLine(
  taskLabel: string,
  elapsedMs: number,
  idleMs: number,
  lastActivity: string,
): string {
  return `[timer] ${taskLabel} elapsed=${formatElapsedSeconds(elapsedMs)} idle=${formatElapsedSeconds(idleMs)} last=${truncateText(lastActivity, 80)}`;
}

export function formatQueueTimerLine(taskLabel: string, waitedMs: number, queuePosition?: number): string {
  const positionSuffix = typeof queuePosition === "number" && queuePosition > 0 ? ` pos=${queuePosition}` : "";
  return `[wait] ${taskLabel} waited=${formatWaitSeconds(waitedMs)}${positionSuffix}`;
}

function previewText(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const preview = truncateText(value, maxLength);
  return preview.length > 0 ? preview : undefined;
}

function formatCommand(argv: string[]): string {
  return argv.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function formatTaskLabel(task: TrackedCliTask): string {
  if (typeof task.total === "number" && task.total > 1) {
    return `${task.ordinal}/${task.total} ${task.taskId}`;
  }

  return task.taskId;
}

function summarizePlan(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "no tool calls";
  }

  return value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.toolName !== "string") {
        return "unknown";
      }
      return entry.toolName;
    })
    .join(" -> ");
}

function formatToolRequest(toolName: string, args: unknown): string {
  const input = isRecord(args) ? args : {};

  switch (toolName) {
    case "read_file":
      return `read ${typeof input.path === "string" ? input.path : "(missing path)"}`;
    case "list_files":
      return `list ${typeof input.path === "string" ? input.path : "."}`;
    case "write_file":
      return `write ${typeof input.path === "string" ? input.path : "(missing path)"}`;
    case "patch_file":
      return `patch ${typeof input.path === "string" ? input.path : "(missing path)"}`;
    case "shell_exec": {
      const argv = Array.isArray(input.argv) ? input.argv.filter((value) => typeof value === "string") : [];
      const command = typeof input.command === "string" ? input.command : "(missing command)";
      return `cmd ${formatCommand([command, ...argv])}`;
    }
    case "open_browser":
      return `open ${typeof input.path === "string" ? input.path : "(missing path)"}`;
    case "web_search":
      return `web ${typeof input.query === "string" ? truncateText(input.query, 80) : "(missing query)"}`;
    case "open_browser_search":
      return `search ${typeof input.query === "string" ? truncateText(input.query, 80) : "(missing query)"}`;
    case "git_diff":
      return "cmd git diff --no-ext-diff --minimal";
    default:
      return `${toolName} ${truncateText(formatDebugPayload(args), 80)}`;
  }
}

function formatToolResult(toolName: string, result: unknown): string {
  const rawOutput = isRecord(result) ? result : {};
  const output =
    isRecord(rawOutput.payload)
      ? rawOutput.payload
      : rawOutput;

  switch (toolName) {
    case "read_file": {
      const path = typeof output.path === "string" ? output.path : "(unknown path)";
      const content = typeof output.content === "string" ? output.content : "";
      const preview = previewText(content, 100);
      return preview ? `read ${path} chars=${content.length} preview="${preview}"` : `read ${path} chars=${content.length}`;
    }
    case "list_files": {
      const path = typeof output.path === "string" ? output.path : ".";
      const entries = Array.isArray(output.entries) ? output.entries : [];
      const names = entries
        .map((entry) => (isRecord(entry) && typeof entry.name === "string" ? entry.name : undefined))
        .filter((entry): entry is string => typeof entry === "string");
      const preview = names.slice(0, 5).join(", ");
      return preview.length > 0
        ? `listed ${path} entries=${entries.length} ${preview}`
        : `listed ${path} entries=${entries.length}`;
    }
    case "write_file": {
      const path = typeof output.path === "string" ? output.path : "(unknown path)";
      const bytesWritten = typeof output.bytesWritten === "number" ? output.bytesWritten : 0;
      const created = output.created === true ? "created" : "updated";
      const preview = previewText(output.preview, 80);
      return preview
        ? `${created} ${path} bytes=${bytesWritten} changed="${preview}"`
        : `${created} ${path} bytes=${bytesWritten}`;
    }
    case "patch_file": {
      const path = typeof output.path === "string" ? output.path : "(unknown path)";
      const replacements = typeof output.replacements === "number" ? output.replacements : 0;
      const searchPreview = previewText(output.search, 40);
      const replacePreview = previewText(output.replace, 40);
      if (searchPreview && replacePreview) {
        return `patched ${path} replacements=${replacements} "${searchPreview}" -> "${replacePreview}"`;
      }
      return `patched ${path} replacements=${replacements}`;
    }
    case "shell_exec": {
      const command = typeof output.command === "string" ? output.command : "command";
      const argv = Array.isArray(output.argv) ? output.argv.filter((value) => typeof value === "string") : [];
      const stdoutPreview = previewText(output.stdout, 100);
      const stderrPreview = previewText(output.stderr, 100);
      const commandText = formatCommand([command, ...argv]);
      if (stdoutPreview) {
        return `${commandText} stdout="${stdoutPreview}"`;
      }
      if (stderrPreview) {
        return `${commandText} stderr="${stderrPreview}"`;
      }
      return `${commandText} completed`;
    }
    case "git_diff": {
      const preview = previewText(output.output, 100);
      return preview ? `git diff preview="${preview}"` : "git diff completed";
    }
    case "open_browser": {
      const path = typeof output.path === "string" ? output.path : "(unknown path)";
      const command = typeof output.command === "string" ? output.command : "browser";
      return `opened ${path} via ${command}`;
    }
    case "web_search": {
      const query = typeof output.query === "string" ? output.query : "(unknown query)";
      const results = Array.isArray(output.results) ? output.results : [];
      const firstTitle = results
        .map((entry) => (isRecord(entry) && typeof entry.title === "string" ? entry.title : undefined))
        .find((entry): entry is string => typeof entry === "string");
      return firstTitle
        ? `searched "${truncateText(query, 50)}" results=${results.length} first="${truncateText(firstTitle, 70)}"`
        : `searched "${truncateText(query, 50)}" results=${results.length}`;
    }
    case "open_browser_search": {
      const query = typeof output.query === "string" ? output.query : "(unknown query)";
      const command = typeof output.command === "string" ? output.command : "browser";
      return `opened search "${truncateText(query, 50)}" via ${command}`;
    }
    default:
      return `${toolName} result=${truncateText(formatDebugPayload(result), 100)}`;
  }
}

function setupCliEventPrinter(
  deps: GatewayLayerDeps,
  sessionId: string,
  debugEnabled: boolean,
): CliEventPrinter {
  if (!deps.eventbus) {
    return {
      trackTask() {},
      teardown() {},
    };
  }

  const trackedTasks = new Map<string, TrackedCliTask>();
  const runToTask = new Map<string, string>();
  const toolCalls = new Map<string, { runId: string; toolName: string; args: unknown }>();
  const latestQueueSnapshots = new Map<string, QueueTaskSnapshot>();
  const taskWaitTimers = new Map<string, NodeJS.Timeout>();
  const runTimers = new Map<string, {
    startedAtMs: number;
    lastActivityAtMs: number;
    lastActivity: string;
    interval: NodeJS.Timeout;
  }>();

  function trackTask(task: TrackedCliTask): void {
    trackedTasks.set(task.taskId, task);
  }

  function updateRunActivity(runId: string, activity: string): void {
    const timer = runTimers.get(runId);
    if (!timer) {
      return;
    }

    timer.lastActivityAtMs = Date.now();
    timer.lastActivity = activity;
  }

  function stopTaskWaitTimer(taskId: string): void {
    const timer = taskWaitTimers.get(taskId);
    if (!timer) {
      return;
    }

    clearInterval(timer);
    taskWaitTimers.delete(taskId);
  }

  function stopRunTimer(runId: string): void {
    const timer = runTimers.get(runId);
    if (!timer) {
      return;
    }

    clearInterval(timer.interval);
    runTimers.delete(runId);
  }

  function printDebug(event: EventBusEvent): void {
    if (!debugEnabled) {
      return;
    }

    console.log(`[debug] ${event.type} ${formatDebugPayload(event)}`);
  }

  const unsubscribers = [
    deps.queue.subscribe((snapshot) => {
      const task = trackedTasks.get(snapshot.task.id);
      if (!task) {
        return;
      }
      latestQueueSnapshots.set(snapshot.task.id, snapshot);

      const createdAtMs = Date.parse(snapshot.task.createdAt);
      const now = Date.now();
      const waitedMs = Number.isNaN(createdAtMs) ? 0 : Math.max(0, now - createdAtMs);

      if (snapshot.status === "pending") {
        if (typeof snapshot.task.queuePosition !== "number" || snapshot.task.queuePosition <= 0) {
          return;
        }
        if (!taskWaitTimers.has(snapshot.task.id)) {
          const interval = setInterval(() => {
            const trackedTask = trackedTasks.get(snapshot.task.id);
            const latestSnapshot = latestQueueSnapshots.get(snapshot.task.id);
            if (!trackedTask || !latestSnapshot) {
              stopTaskWaitTimer(snapshot.task.id);
              return;
            }
            const taskState = latestSnapshot.task;
            const queuedAtMs = Date.parse(taskState.createdAt);
            const elapsedMs = Number.isNaN(queuedAtMs) ? 0 : Math.max(0, Date.now() - queuedAtMs);
            console.log(
              colorizePink(
                formatQueueTimerLine(
                  formatTaskLabel(trackedTask),
                  elapsedMs,
                  typeof taskState.queuePosition === "number" ? taskState.queuePosition : undefined,
                ),
              ),
            );
          }, RUN_TIMER_INTERVAL_MS);
          interval.unref?.();
          taskWaitTimers.set(snapshot.task.id, interval);
        }
        console.log(
          colorizePink(
            `[queue] ${formatTaskLabel(task)} pending pos=${snapshot.task.queuePosition ?? "?"}/${snapshot.queueDepth} waited=${formatWaitSeconds(waitedMs)}`,
          ),
        );
        return;
      }

      stopTaskWaitTimer(snapshot.task.id);
      if (snapshot.status === "running") {
        console.log(colorizePink(`[queue] ${formatTaskLabel(task)} dispatched waited=${formatWaitSeconds(waitedMs)}`));
        return;
      }

      if (snapshot.status === "failed") {
        const kind = snapshot.task.failureKind ?? "runtime";
        console.log(`[queue] ${formatTaskLabel(task)} failed kind=${kind}`);
      }
    }),
    deps.eventbus.subscribe("run.started", (event) => {
      const eventSessionId = readEventField(event, "sessionId");
      const taskId = readEventField(event, "taskId");
      const runId = readEventField(event, "runId");
      if (eventSessionId !== sessionId || typeof taskId !== "string" || typeof runId !== "string") {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      stopTaskWaitTimer(taskId);
      const startedAtMs = Date.now();
      const interval = setInterval(() => {
        const timer = runTimers.get(runId);
        if (!timer) {
          return;
        }

        console.log(
          formatRunTimerLine(
            formatTaskLabel(task),
            Date.now() - timer.startedAtMs,
            Date.now() - timer.lastActivityAtMs,
            timer.lastActivity,
          ),
        );
      }, RUN_TIMER_INTERVAL_MS);
      interval.unref?.();
      runTimers.set(runId, {
        startedAtMs,
        lastActivityAtMs: startedAtMs,
        lastActivity: "run.started",
        interval,
      });
      runToTask.set(runId, taskId);
      console.log(`[run] started ${formatTaskLabel(task)} run=${runId}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("run.heartbeat", (event) => {
      const runId = readEventField(event, "runId");
      const stage = readEventField(event, "stage");
      if (typeof stage !== "string" || typeof runId !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(runId, `stage ${stage}`);
      console.log(`[stage] ${formatTaskLabel(task)} ${formatLayerStage(stage)} ${stage}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("worker.heartbeat", (event) => {
      if (!debugEnabled) {
        return;
      }
      console.log(
        `[debug] worker.heartbeat active=${formatDebugPayload(readEventField(event, "activeWorkers"))} idle=${formatDebugPayload(readEventField(event, "idleWorkers"))} queue=${formatDebugPayload(readEventField(event, "queueDepth"))}`,
      );
      printDebug(event);
    }),
    deps.eventbus.subscribe("prompt.composed", (event) => {
      const runId = readEventField(event, "runId");
      if (typeof runId !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(runId, "prompt.composed");
      const skills = readEventField(event, "selectedSkills");
      const docs = readEventField(event, "loadedDocuments");
      const skillCount = Array.isArray(skills) ? skills.length : 0;
      const documentCount = Array.isArray(docs) ? docs.length : 0;
      console.log(`[context] ${formatTaskLabel(task)} docs=${documentCount} skills=${skillCount}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("agent.plan.generated", (event) => {
      const runId = readEventField(event, "runId");
      if (typeof runId !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      const planSummary = summarizePlan(readEventField(event, "plannedToolCalls"));
      updateRunActivity(runId, `plan ${planSummary}`);
      console.log(colorizeYellow(`[plan] ${formatTaskLabel(task)} ${planSummary}`));
      printDebug(event);
    }),
    deps.eventbus.subscribe("agent.reasoning.summary", (event) => {
      const runId = readEventField(event, "runId");
      const summary = readEventField(event, "summary");
      if (typeof runId !== "string" || typeof summary !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(runId, `think ${summary}`);
      console.log(`[think] ${formatTaskLabel(task)} ${truncateText(summary)}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("agent.step.finished", (event) => {
      const runId = readEventField(event, "runId");
      const stepNumber = readEventField(event, "stepNumber");
      if (typeof runId !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(runId, `step ${formatDebugPayload(stepNumber)}`);
      console.log(`[step] ${formatTaskLabel(task)} finished step=${formatDebugPayload(stepNumber)}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("tool.call.requested", (event) => {
      const runId = readEventField(event, "runId");
      const toolCallId = readEventField(event, "toolCallId");
      const toolName = readEventField(event, "toolName");
      const args = readEventField(event, "args");
      if (typeof runId !== "string" || typeof toolCallId !== "string" || typeof toolName !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      toolCalls.set(toolCallId, { runId, toolName, args });
      const activity = formatToolRequest(toolName, args);
      updateRunActivity(runId, `act ${activity}`);
      console.log(colorizeGreen(`[act] ${formatTaskLabel(task)} ${activity}`));
      printDebug(event);
    }),
    deps.eventbus.subscribe("tool.call.result", (event) => {
      const toolCallId = readEventField(event, "toolCallId");
      const result = readEventField(event, "result");
      if (typeof toolCallId !== "string") {
        return;
      }
      const toolCall = toolCalls.get(toolCallId);
      if (!toolCall) {
        return;
      }
      const taskId = runToTask.get(toolCall.runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      const activity = formatToolResult(toolCall.toolName, result);
      updateRunActivity(toolCall.runId, `done ${activity}`);
      console.log(colorizeGreen(`[done] ${formatTaskLabel(task)} ${activity}`));
      toolCalls.delete(toolCallId);
      printDebug(event);
    }),
    deps.eventbus.subscribe("tool.call.failed", (event) => {
      const toolCallId = readEventField(event, "toolCallId");
      const error = readEventField(event, "error");
      if (typeof toolCallId !== "string") {
        return;
      }
      const toolCall = toolCalls.get(toolCallId);
      if (!toolCall) {
        return;
      }
      const taskId = runToTask.get(toolCall.runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(toolCall.runId, `fail ${toolCall.toolName}`);
      console.log(
        `[fail] ${formatTaskLabel(task)} ${toolCall.toolName} ${truncateText(typeof error === "string" ? error : "unknown error", 100)}`,
      );
      toolCalls.delete(toolCallId);
      printDebug(event);
    }),
    deps.eventbus.subscribe("agent.answer.produced", (event) => {
      const runId = readEventField(event, "runId");
      const answer = readEventField(event, "answer");
      if (typeof runId !== "string" || typeof answer !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      updateRunActivity(runId, "answer.produced");
      console.log(`[answer] ${formatTaskLabel(task)} ${truncateText(answer)}`);
      printDebug(event);
    }),
    deps.eventbus.subscribe("run.finished", (event) => {
      const runId = readEventField(event, "runId");
      const success = readEventField(event, "success");
      if (typeof runId !== "string") {
        return;
      }
      const taskId = runToTask.get(runId);
      if (!taskId) {
        return;
      }
      const task = trackedTasks.get(taskId);
      if (!task) {
        return;
      }
      stopRunTimer(runId);
      stopTaskWaitTimer(taskId);
      console.log(`[run] finished ${formatTaskLabel(task)} success=${formatDebugPayload(success)}`);
      runToTask.delete(runId);
      printDebug(event);
    }),
  ];

  return {
    trackTask,
    teardown() {
      latestQueueSnapshots.clear();
      for (const timer of taskWaitTimers.values()) {
        clearInterval(timer);
      }
      taskWaitTimers.clear();
      for (const timer of runTimers.values()) {
        clearInterval(timer.interval);
      }
      runTimers.clear();
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    },
  };
}

function printRunResult(result: CliRunResult): void {
  if (result.runId) {
    console.log(`[gateway] runId: ${result.runId}`);
  }
  if (typeof result.queueWaitMs === "number") {
    console.log(`[gateway] queueWaitMs: ${result.queueWaitMs}`);
  }
  if (typeof result.stepsUsed === "number") {
    console.log(`[gateway] steps: ${result.stepsUsed}`);
  }
  if (typeof result.toolSummaryCount === "number") {
    console.log(`[gateway] tool summaries: ${result.toolSummaryCount}`);
  }
  if (typeof result.durationMs === "number") {
    console.log(`[gateway] runDurationMs: ${result.durationMs}`);
  }
  if (typeof result.totalDurationMs === "number") {
    console.log(`[gateway] totalDurationMs: ${result.totalDurationMs}`);
  }
  if (!result.ok && result.failureKind) {
    console.log(`[gateway] failureKind: ${result.failureKind}`);
  }
  if (!result.ok && result.errorMessage) {
    console.log(`[gateway] error: ${result.errorMessage}`);
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
      `${index + 1}. task=${entry.taskId} run=${entry.runId ?? "n/a"} wait=${entry.queueWaitMs ?? 0}ms steps=${entry.stepsUsed ?? 0} answer=${answerPreview}${suffix}`,
    );
  }
}

function buildCliRunResult(taskId: string, fields: Omit<CliRunResult, "taskId"> = {}): CliRunResult {
  return {
    taskId,
    ...fields,
  };
}

export function buildInteractiveFollowUpInput(
  baseInput: string,
  supplements: string[],
  previousResult: CliRunResult,
): string {
  const lines = [
    "Follow up the previous interactive task using the user's mid-run refinements.",
    `Previous user task: ${baseInput}`,
  ];

  if (typeof previousResult.finalAnswer === "string" && previousResult.finalAnswer.length > 0) {
    lines.push(
      `Previous result summary: ${truncateText(previousResult.finalAnswer, FOLLOW_UP_ANSWER_PREVIEW_LIMIT)}`,
    );
  } else if (previousResult.ok === false) {
    lines.push(`Previous task failed or timed out. taskId=${previousResult.taskId}`);
  }

  lines.push("New user refinements received while the previous run was executing:");
  for (const [index, supplement] of supplements.entries()) {
    lines.push(`${index + 1}. ${supplement}`);
  }
  lines.push("Revise or continue the work accordingly. Reuse files already written when appropriate.");

  return lines.join("\n");
}

export function createGatewayLayer(deps: GatewayLayerDeps): GatewayLayerApi {
  function createTask(taskInput: string, sessionId: string): RunTask {
    return {
      id: createId("task"),
      sessionId,
      input: taskInput,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  async function enqueueTask(task: RunTask, trackedTask?: TrackedCliTask): Promise<void> {
    await deps.queue.enqueue(task);
    const taskLabel = trackedTask ? formatTaskLabel(trackedTask) : task.id;
    console.log(`[queue] queued ${taskLabel} ${truncateText(task.input, 90)}`);
  }

  async function waitForTaskResult(task: RunTask): Promise<CliRunResult> {
    const result = await deps.queue.waitForCompletion(task.id);
    const durationMs = formatDurationMs(result.task);
    const queueWaitMs =
      result.task.startedAt && result.task.createdAt
        ? Math.max(0, Date.parse(result.task.startedAt) - Date.parse(result.task.createdAt))
        : undefined;
    const totalDurationMs =
      result.task.finishedAt && result.task.createdAt
        ? Math.max(0, Date.parse(result.task.finishedAt) - Date.parse(result.task.createdAt))
        : undefined;
    if (result.status === "failed") {
      console.error(`[gateway] task ${task.id} failed: ${result.task.errorMessage ?? "unknown error"}`);
      process.exitCode = 1;
      const cliRunResult = buildCliRunResult(task.id, {
        taskInput: task.input,
        ok: false,
        ...(result.task.failureKind ? { failureKind: result.task.failureKind } : {}),
        ...(result.task.errorMessage ? { errorMessage: result.task.errorMessage } : {}),
        ...(typeof queueWaitMs === "number" ? { queueWaitMs } : {}),
        ...(typeof durationMs === "number" ? { durationMs } : {}),
        ...(typeof totalDurationMs === "number" ? { totalDurationMs } : {}),
      });
      printRunResult(cliRunResult);
      return cliRunResult;
    }

    console.log(`[gateway] task ${task.id} completed`);
    const cliRunResult = buildCliRunResult(task.id, {
      taskInput: task.input,
      ok: true,
      ...(result.task.runId ? { runId: result.task.runId } : {}),
      ...(result.task.finalAnswer ? { finalAnswer: result.task.finalAnswer } : {}),
      ...(typeof result.task.stepsUsed === "number" ? { stepsUsed: result.task.stepsUsed } : {}),
      ...(typeof result.task.toolSummaryCount === "number"
        ? { toolSummaryCount: result.task.toolSummaryCount }
        : {}),
      ...(typeof queueWaitMs === "number" ? { queueWaitMs } : {}),
      ...(typeof durationMs === "number" ? { durationMs } : {}),
      ...(typeof totalDurationMs === "number" ? { totalDurationMs } : {}),
    });
    printRunResult(cliRunResult);
    return cliRunResult;
  }

  async function runTaskInput(
    taskInput: string,
    sessionId: string,
    printer?: CliEventPrinter,
    trackedTask?: TrackedCliTask,
  ): Promise<CliRunResult> {
    const task = createTask(taskInput, sessionId);
    const taskMeta: TrackedCliTask =
      trackedTask ?? {
        taskId: task.id,
        taskInput,
        ordinal: 1,
      };
    printer?.trackTask({
      ...taskMeta,
      taskId: task.id,
    });
    await enqueueTask(task, {
      ...taskMeta,
      taskId: task.id,
    });
    return waitForTaskResult(task);
  }

  async function runTaskBatch(taskInputs: string[], sessionId: string, debugEnabled: boolean): Promise<CliRunResult[]> {
    const printer = setupCliEventPrinter(deps, sessionId, debugEnabled);
    const tasks = taskInputs.map((taskInput) => createTask(taskInput, sessionId));
    const trackedTasks = tasks.map((task, index) => ({
      taskId: task.id,
      taskInput: task.input,
      ordinal: index + 1,
      total: tasks.length,
    }));

    console.log(`[orchestrator] session=${sessionId} queuedTasks=${tasks.length}`);

    try {
      for (const trackedTask of trackedTasks) {
        printer.trackTask(trackedTask);
      }

      for (const [index, task] of tasks.entries()) {
        await enqueueTask(task, trackedTasks[index]);
      }

      const resultPromises = tasks.map((task) => waitForTaskResult(task));
      const results: CliRunResult[] = [];
      for (const resultPromise of resultPromises) {
        results.push(await resultPromise);
      }

      if (results.length > 1) {
        const okCount = results.filter((result) => result.ok).length;
        console.log(`[orchestrator] completed ${okCount}/${results.length} task(s) successfully`);
      }

      return results;
    } finally {
      printer.teardown();
    }
  }

  async function startInteractiveCli(): Promise<void> {
    const sessionId = createId("session");
    const rl = createInterface({ input, output });
    const history: CliRunResult[] = [];
    const debugEnabled = process.env.CATNIP_CLI_DEBUG === "1" || process.argv.includes("--debug");
    const printer = setupCliEventPrinter(deps, sessionId, debugEnabled);
    let activeTask: ActiveInteractiveTask | undefined;
    let exitRequested = false;

    await printCliStartupAnimation();
    console.log("Catnip interactive CLI");
    console.log("Type your task and press Enter. Use /help, /history, /last, /clear or /exit.");
    console.log("While a task is running, extra input is captured as follow-up refinements for the next turn.");
    rl.setPrompt(getInteractivePrompt());
    rl.prompt();

    try {
      rl.on("line", (rawLine) => {
        const line = rawLine.trim();
        if (line.length === 0) {
          rl.prompt();
          return;
        }

        const command = parseInteractiveCommand(line);
        if (command.type === "exit") {
          exitRequested = true;
          if (activeTask) {
            console.log("[gateway] exit requested; waiting for the active task to finish");
            return;
          }
          rl.close();
          return;
        }

        if (command.type === "help") {
          printHelp();
          rl.prompt();
          return;
        }

        if (command.type === "history") {
          printHistory(history);
          rl.prompt();
          return;
        }

        if (command.type === "last") {
          const lastResult = history.at(-1);
          if (!lastResult) {
            console.log("[gateway] no previous result in this interactive session");
            rl.prompt();
            return;
          }
          printRunResult(lastResult);
          rl.prompt();
          return;
        }

        if (command.type === "clear") {
          history.length = 0;
          console.log("[gateway] cleared interactive session history");
          rl.prompt();
          return;
        }

        if (command.type !== "task") {
          rl.prompt();
          return;
        }

        const taskInput = command.taskInput ?? "";
        if (activeTask) {
          activeTask.supplements.push(taskInput);
          console.log(
            `[interactive] captured refinement for task ${activeTask.ordinal}: ${truncateText(taskInput, 90)}`,
          );
          rl.prompt();
          return;
        }

        startInteractiveTask(taskInput, history.length + 1);
        rl.prompt();
      });

      rl.on("close", () => {
        exitRequested = true;
      });

      await once(rl, "close");
    } finally {
      printer.teardown();
      rl.close();
    }

    function startInteractiveTask(taskInput: string, ordinal: number): void {
      const completion = (async () => {
        const cliRunResult = await runTaskInput(taskInput, sessionId, printer, {
          taskId: "",
          taskInput,
          ordinal,
        });
        history.push(cliRunResult);

        const finishedTask = activeTask;
        activeTask = undefined;

        if (finishedTask && finishedTask.supplements.length > 0) {
          if (exitRequested) {
            console.log(
              `[interactive] dropping ${finishedTask.supplements.length} pending refinement(s) because exit was requested`,
            );
            rl.close();
            return;
          }
          const followUpInput = buildInteractiveFollowUpInput(
            finishedTask.baseInput,
            finishedTask.supplements,
            cliRunResult,
          );
          console.log(
            `[interactive] scheduling follow-up for task ${finishedTask.ordinal} with ${finishedTask.supplements.length} refinement(s)`,
          );
          startInteractiveTask(followUpInput, history.length + 1);
          rl.prompt();
          return;
        }

        if (exitRequested) {
          rl.close();
          return;
        }

        rl.prompt();
      })().catch((error: unknown) => {
        activeTask = undefined;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[gateway] interactive task crashed: ${message}`);
        process.exitCode = 1;
        if (exitRequested) {
          rl.close();
          return;
        }
        rl.prompt();
      });

      activeTask = {
        baseInput: taskInput,
        ordinal,
        supplements: [],
        completion,
      };
    }
  }

  return {
    async startCli(): Promise<void> {
      const parsed = parseCliArgs(process.argv.slice(2));
      const debugEnabled = parsed.debug || process.env.CATNIP_CLI_DEBUG === "1";
      if (debugEnabled) {
        console.log("[gateway] debug output enabled");
        console.log("[gateway] trace log file: logs/catnip-trace.jsonl");
      }
      if (parsed.showHelp) {
        printHelp();
        return;
      }

      const fileTasks = parsed.tasksFilePath ? await readTasksFile(parsed.tasksFilePath) : [];
      const mergedTasks = [...parsed.tasks, ...fileTasks].filter((task) => task.length > 0);

      if (mergedTasks.length > 0) {
        await runTaskBatch(mergedTasks, createId("session"), debugEnabled);
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

      await runTaskBatch([stdinText], createId("session"), debugEnabled);
    },
  };
}
