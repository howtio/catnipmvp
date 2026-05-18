import type { RunTask, RunTaskStatus } from "../../shared/types/runTask.js";

export interface QueueTaskSnapshot {
  task: RunTask;
  status: RunTaskStatus;
}

export interface QueueLayerApi {
  enqueue(task: RunTask): Promise<void>;
  dequeue(): Promise<RunTask | undefined>;
  waitForTask(): Promise<RunTask>;
  setStatus(taskId: string, status: RunTaskStatus, patch?: Partial<RunTask>): void;
  getStatus(taskId: string): RunTaskStatus | undefined;
  getTask(taskId: string): RunTask | undefined;
  waitForCompletion(taskId: string): Promise<QueueTaskSnapshot>;
  size(): number;
}
