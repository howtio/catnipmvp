import type { EnrichedRunContext } from "../06-skills/index.js";

export interface MemoryObservation {
  type: "file" | "directory" | "url" | "query";
  value: string;
  toolName: string;
  action: "read" | "write" | "patch" | "open" | "list" | "copy" | "move" | "search";
  openable?: boolean;
  observedAt: string;
}

export interface MemoryToolSummary {
  toolName: string;
  ok: boolean;
  reason: string;
  result?: unknown;
  error?: string;
}

export interface MemoryEntry {
  runId: string;
  taskId: string;
  taskInput: string;
  finalAnswer: string;
  stepsUsed: number;
  toolSummaryCount: number;
  success: boolean;
  recordedAt: string;
  observations: MemoryObservation[];
}

export interface MemoryWorkingSet {
  focusedFilePath?: string;
  focusedOpenableHtmlPath?: string;
  recentFilePaths: string[];
  openableHtmlPaths: string[];
  recentDirectoryPaths: string[];
  recentUrls: string[];
  recentQueries: string[];
}

export interface MemorySnapshot {
  sessionId: string;
  recentEntries: MemoryEntry[];
  summary: string;
  workingSet: MemoryWorkingSet;
}

export interface MemoryEnrichedRunContext extends EnrichedRunContext {
  memory: MemorySnapshot;
}

export interface RememberRunInput {
  runId: string;
  taskId: string;
  sessionId: string;
  taskInput: string;
  finalAnswer: string;
  stepsUsed: number;
  toolSummaryCount: number;
  success: boolean;
  toolSummaries: MemoryToolSummary[];
}

export interface MemoryLayerDeps {
  maxEntries?: number;
}

export interface MemoryLayerApi {
  hydrateContext(context: EnrichedRunContext): Promise<MemoryEnrichedRunContext>;
  rememberRun(input: RememberRunInput): Promise<void>;
}
