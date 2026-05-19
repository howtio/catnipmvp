export type RunTaskStatus = "pending" | "running" | "done" | "failed";

export interface RunTask {
  id: string;
  sessionId: string;
  input: string;
  status: RunTaskStatus;
  createdAt: string;
  updatedAt?: string;
  queueEnteredAt?: string;
  queuePosition?: number;
  startedAt?: string;
  finishedAt?: string;
  runId?: string;
  finalAnswer?: string;
  stepsUsed?: number;
  toolSummaryCount?: number;
  failureKind?: "timeout" | "runtime";
  errorMessage?: string;
}
