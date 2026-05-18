export type RunTaskStatus = "pending" | "running" | "done" | "failed";

export interface RunTask {
  id: string;
  sessionId: string;
  input: string;
  status: RunTaskStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}
