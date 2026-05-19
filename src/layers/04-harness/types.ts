import type { RunTask } from "../../shared/types/runTask.js";
import type { RunContext } from "../05-context/index.js";
import type { EnrichedRunContext } from "../06-skills/index.js";
import type { MemoryEnrichedRunContext } from "../06.5-memory/index.js";
import type { RunnerRunResult } from "../07-runner/index.js";

export interface HarnessRunLimits {
  runTimeoutMs: number;
}

export interface RunFinalReport {
  runId: string;
  taskId: string;
  sessionId: string;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  selectedSkills: string[];
  loadedDocuments: string[];
  stepsUsed: number;
  finalAnswer: string;
  toolSummaryCount: number;
}

export interface HarnessLayerDeps {
  context: {
    buildContext(runId: string, task: RunTask): Promise<RunContext>;
  };
  skills: {
    injectSkills(context: RunContext): Promise<EnrichedRunContext>;
  };
  memory: {
    hydrateContext(context: EnrichedRunContext): Promise<MemoryEnrichedRunContext>;
    rememberRun(input: {
      runId: string;
      taskId: string;
      sessionId: string;
      taskInput: string;
      finalAnswer: string;
      stepsUsed: number;
      toolSummaryCount: number;
      success: boolean;
    }): Promise<void>;
  };
  runner: {
    run(context: MemoryEnrichedRunContext): Promise<RunnerRunResult>;
  };
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
  };
  reportLogger: {
    write(entry: Record<string, unknown>): void;
  };
  limits?: Partial<HarnessRunLimits>;
}

export interface HarnessLayerApi {
  runTask(task: RunTask): Promise<RunFinalReport>;
}
