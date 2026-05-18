import type { RunTask } from "../../shared/types/runTask.js";
import type { RunContext } from "../05-context/index.js";
import type { EnrichedRunContext } from "../06-skills/index.js";

export interface RunFinalReport {
  runId: string;
  taskId: string;
  sessionId: string;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  selectedSkills: string[];
  loadedDocuments: string[];
}

export interface HarnessLayerDeps {
  context: {
    buildContext(runId: string, task: RunTask): Promise<RunContext>;
  };
  skills: {
    injectSkills(context: RunContext): Promise<EnrichedRunContext>;
  };
  runner: {
    run(context: EnrichedRunContext): Promise<void>;
  };
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
  };
  reportLogger: {
    write(entry: Record<string, unknown>): void;
  };
}

export interface HarnessLayerApi {
  runTask(task: RunTask): Promise<RunFinalReport>;
}
