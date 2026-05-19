import type { EnrichedRunContext } from "../06-skills/index.js";

export interface MemoryEntry {
  runId: string;
  taskId: string;
  taskInput: string;
  finalAnswer: string;
  stepsUsed: number;
  toolSummaryCount: number;
  success: boolean;
  recordedAt: string;
}

export interface MemorySnapshot {
  sessionId: string;
  recentEntries: MemoryEntry[];
  summary: string;
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
}

export interface MemoryLayerDeps {
  maxEntries?: number;
}

export interface MemoryLayerApi {
  hydrateContext(context: EnrichedRunContext): Promise<MemoryEnrichedRunContext>;
  rememberRun(input: RememberRunInput): Promise<void>;
}
