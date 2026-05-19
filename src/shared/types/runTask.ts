export type RunTaskStatus = "pending" | "running" | "done" | "failed";

export interface RunTask {
  id: string;
  sessionId: string;
  input: string;
  status: RunTaskStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  runId?: string;
  finalAnswer?: string;
  stepsUsed?: number;
  toolSummaryCount?: number;
  errorMessage?: string;
}
