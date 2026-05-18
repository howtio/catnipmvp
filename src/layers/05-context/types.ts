import type { RunTask } from "../../shared/types/runTask.js";

export interface ContextDocumentSummary {
  path: string;
  summary: string;
}

export interface WorkspaceSummary {
  root: string;
  topLevelEntries: string[];
  layerDirectories: string[];
}

export interface RunContext {
  runId: string;
  task: RunTask;
  docs: {
    coreDocuments: ContextDocumentSummary[];
  };
  workspace: WorkspaceSummary;
  sessionHistory: string[];
  systemPrompt: string;
}

export interface ContextLayerApi {
  buildContext(runId: string, task: RunTask): Promise<RunContext>;
}
