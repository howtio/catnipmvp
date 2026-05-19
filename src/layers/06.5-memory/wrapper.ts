import type {
  MemoryEntry,
  MemoryEnrichedRunContext,
  MemoryLayerApi,
  MemoryLayerDeps,
  MemoryObservation,
  MemoryToolSummary,
  MemoryWorkingSet,
  RememberRunInput,
} from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";

const DEFAULT_MAX_ENTRIES = 5;

function normalizeWorkspaceLikePath(value: string): string {
  const trimmed = value.trim().replaceAll("\\", "/");
  if (trimmed.startsWith("./")) {
    return trimmed.slice(2);
  }
  if (trimmed.startsWith("/workspaces/")) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function isHtmlPath(value: string): boolean {
  return /\.html?$/i.test(value);
}

function isOpenableHtmlPath(value: string): boolean {
  return value.startsWith("workspaces/demo/") && isHtmlPath(value);
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readStringField(value: unknown, key: string): string | undefined {
  const record = asObject(value);
  const field = record?.[key];
  return typeof field === "string" && field.trim().length > 0 ? field.trim() : undefined;
}

function readStringArrayField(value: unknown, key: string): string[] {
  const record = asObject(value);
  const field = record?.[key];
  if (!Array.isArray(field)) {
    return [];
  }

  return field.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function pushUnique(values: string[], nextValue: string | undefined): void {
  if (!nextValue || values.includes(nextValue)) {
    return;
  }

  values.push(nextValue);
}

function toSessionHistoryEntry(entry: MemoryEntry): string {
  const answerPreview = entry.finalAnswer.trim().length > 0 ? entry.finalAnswer.trim().slice(0, 240) : "(no final answer)";
  const focusPath = entry.observations
    .filter((observation) => observation.type === "file")
    .map((observation) => observation.value)
    .at(-1);
  return [
    `Task: ${entry.taskInput}`,
    `Answer: ${answerPreview}`,
    `Steps: ${entry.stepsUsed}`,
    `Tools: ${entry.toolSummaryCount}`,
    `Success: ${entry.success}`,
    `Focus: ${focusPath ?? "none"}`,
  ].join(" | ");
}

function dedupeNewestFirst(values: string[]): string[] {
  const deduped: string[] = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value === undefined) {
      continue;
    }
    if (!deduped.includes(value)) {
      deduped.push(value);
    }
  }
  return deduped;
}

function buildWorkingSet(entries: MemoryEntry[]): MemoryWorkingSet {
  const fileValues: string[] = [];
  const openableHtmlValues: string[] = [];
  const directoryValues: string[] = [];
  const urlValues: string[] = [];
  const queryValues: string[] = [];
  let focusedFilePath: string | undefined;
  let focusedOpenableHtmlPath: string | undefined;

  for (const entry of entries) {
    for (const observation of entry.observations) {
      if (observation.type === "file") {
        pushUnique(fileValues, observation.value);
        if (observation.openable) {
          pushUnique(openableHtmlValues, observation.value);
        }
        if (observation.action !== "list") {
          focusedFilePath = observation.value;
          if (observation.openable) {
            focusedOpenableHtmlPath = observation.value;
          }
        } else {
          if (!focusedFilePath) {
            focusedFilePath = observation.value;
          }
          if (observation.openable && !focusedOpenableHtmlPath) {
            focusedOpenableHtmlPath = observation.value;
          }
        }
        continue;
      }

      if (observation.type === "directory") {
        pushUnique(directoryValues, observation.value);
        continue;
      }

      if (observation.type === "url") {
        pushUnique(urlValues, observation.value);
        continue;
      }

      if (observation.type === "query") {
        pushUnique(queryValues, observation.value);
      }
    }
  }

  const recentFilePaths = dedupeNewestFirst(fileValues);
  const openableHtmlPaths = dedupeNewestFirst(openableHtmlValues);
  if (!focusedOpenableHtmlPath) {
    focusedOpenableHtmlPath = openableHtmlPaths[0];
  }
  if (!focusedFilePath) {
    focusedFilePath = recentFilePaths[0];
  }

  const workingSet: MemoryWorkingSet = {
    recentFilePaths,
    openableHtmlPaths,
    recentDirectoryPaths: dedupeNewestFirst(directoryValues),
    recentUrls: dedupeNewestFirst(urlValues),
    recentQueries: dedupeNewestFirst(queryValues),
  };

  if (focusedFilePath) {
    workingSet.focusedFilePath = focusedFilePath;
  }
  if (focusedOpenableHtmlPath) {
    workingSet.focusedOpenableHtmlPath = focusedOpenableHtmlPath;
  }

  return workingSet;
}

function buildMemorySummary(entries: MemoryEntry[], workingSet: MemoryWorkingSet): string {
  if (entries.length === 0) {
    return [
      "No prior session memory is available.",
      "Focused file: none.",
      "Openable HTML artifacts: none.",
    ].join("\n");
  }

  const lines = entries.map((entry, index) => {
    const answerPreview = entry.finalAnswer.trim().length > 0 ? entry.finalAnswer.trim().slice(0, 180) : "(no final answer)";
    const focusPath = entry.observations
      .filter((observation) => observation.type === "file")
      .map((observation) => observation.value)
      .at(-1) ?? "none";
    return `${index + 1}. task="${entry.taskInput}" focus="${focusPath}" steps=${entry.stepsUsed} tools=${entry.toolSummaryCount} success=${entry.success} answer="${answerPreview}"`;
  });

  return [
    "Recent session memory:",
    `Focused file: ${workingSet.focusedFilePath ?? "none"}`,
    `Focused openable HTML: ${workingSet.focusedOpenableHtmlPath ?? "none"}`,
    `Openable HTML artifacts: ${workingSet.openableHtmlPaths.join(", ") || "none"}`,
    `Recent files: ${workingSet.recentFilePaths.join(", ") || "none"}`,
    ...lines,
  ].join("\n");
}

function createFileObservation(
  path: string,
  toolName: string,
  action: MemoryObservation["action"],
  observedAt: string,
): MemoryObservation {
  const normalizedPath = normalizeWorkspaceLikePath(path);
  return {
    type: "file",
    value: normalizedPath,
    toolName,
    action,
    openable: isOpenableHtmlPath(normalizedPath),
    observedAt,
  };
}

function extractListFileObservations(result: unknown, observedAt: string): MemoryObservation[] {
  const observations: MemoryObservation[] = [];
  const basePath = readStringField(result, "path");
  if (basePath) {
    observations.push({
      type: "directory",
      value: normalizeWorkspaceLikePath(basePath),
      toolName: "list_files",
      action: "list",
      observedAt,
    });
  }

  const record = asObject(result);
  const entries = Array.isArray(record?.entries) ? record.entries : [];
  const normalizedBasePath = basePath ? normalizeWorkspaceLikePath(basePath) : ".";
  for (const entry of entries) {
    const item = asObject(entry);
    const name = typeof item?.name === "string" ? item.name : undefined;
    const type = typeof item?.type === "string" ? item.type : undefined;
    if (!name || type !== "file") {
      continue;
    }

    const combinedPath = normalizedBasePath === "." ? name : `${normalizedBasePath}/${name}`;
    if (!isHtmlPath(combinedPath)) {
      continue;
    }

    observations.push(createFileObservation(combinedPath, "list_files", "list", observedAt));
  }

  return observations;
}

function extractShellFileObservations(result: unknown, observedAt: string): MemoryObservation[] {
  const command = readStringField(result, "command");
  const argv = readStringArrayField(result, "argv");
  if (!command || argv.length < 2) {
    return [];
  }

  const normalizedCommand = command.toLowerCase();
  if (normalizedCommand !== "cp" && normalizedCommand !== "mv") {
    return [];
  }

  const destination = argv.at(-1);
  if (!destination) {
    return [];
  }

  return [
    createFileObservation(
      destination,
      "shell_exec",
      normalizedCommand === "cp" ? "copy" : "move",
      observedAt,
    ),
  ];
}

function extractObservationsFromToolSummary(summary: MemoryToolSummary, observedAt: string): MemoryObservation[] {
  if (!summary.ok) {
    return [];
  }

  switch (summary.toolName) {
    case "write_file": {
      const path = readStringField(summary.result, "path");
      return path ? [createFileObservation(path, summary.toolName, "write", observedAt)] : [];
    }
    case "read_file": {
      const path = readStringField(summary.result, "path");
      return path ? [createFileObservation(path, summary.toolName, "read", observedAt)] : [];
    }
    case "patch_file": {
      const path = readStringField(summary.result, "path");
      return path ? [createFileObservation(path, summary.toolName, "patch", observedAt)] : [];
    }
    case "open_browser": {
      const path = readStringField(summary.result, "path");
      return path ? [createFileObservation(path, summary.toolName, "open", observedAt)] : [];
    }
    case "list_files":
      return extractListFileObservations(summary.result, observedAt);
    case "shell_exec":
      return extractShellFileObservations(summary.result, observedAt);
    case "open_url": {
      const url = readStringField(summary.result, "url");
      return url
        ? [{
            type: "url",
            value: url,
            toolName: summary.toolName,
            action: "open",
            observedAt,
          }]
        : [];
    }
    case "web_search":
    case "open_browser_search": {
      const query = readStringField(summary.result, "query");
      return query
        ? [{
            type: "query",
            value: query,
            toolName: summary.toolName,
            action: "search",
            observedAt,
          }]
        : [];
    }
    default:
      return [];
  }
}

export function createMemoryLayer(deps: MemoryLayerDeps = {}): MemoryLayerApi {
  const maxEntries = deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const sessionMemory = new Map<string, MemoryEntry[]>();

  return {
    async hydrateContext(context: EnrichedRunContext): Promise<MemoryEnrichedRunContext> {
      const recentEntries = [...(sessionMemory.get(context.task.sessionId) ?? [])];
      const workingSet = buildWorkingSet(recentEntries);
      const summary = buildMemorySummary(recentEntries, workingSet);
      const sessionHistory = [
        ...context.sessionHistory,
        ...recentEntries.map((entry) => toSessionHistoryEntry(entry)),
      ];

      return {
        ...context,
        sessionHistory,
        systemPrompt: [
          context.systemPrompt,
          "Session working memory follows.",
          summary,
          "When the user says phrases like 'this game', 'this page', '这个游戏', '这个文件' or 'open it', prefer the focused file or focused openable HTML artifact before scanning the workspace.",
        ].join("\n\n"),
        memory: {
          sessionId: context.task.sessionId,
          recentEntries,
          summary,
          workingSet,
        },
      };
    },

    async rememberRun(input: RememberRunInput): Promise<void> {
      const recordedAt = new Date().toISOString();
      const observations = input.toolSummaries.flatMap((summary) => extractObservationsFromToolSummary(summary, recordedAt));
      const entry: MemoryEntry = {
        runId: input.runId,
        taskId: input.taskId,
        taskInput: input.taskInput,
        finalAnswer: input.finalAnswer,
        stepsUsed: input.stepsUsed,
        toolSummaryCount: input.toolSummaryCount,
        success: input.success,
        recordedAt,
        observations,
      };
      const existingEntries = sessionMemory.get(input.sessionId) ?? [];
      const nextEntries = [...existingEntries, entry].slice(-maxEntries);
      sessionMemory.set(input.sessionId, nextEntries);
    },
  };
}
