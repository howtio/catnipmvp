import type { RunTask } from "../../shared/types/runTask.js";

export interface WorkerLayerDeps {
  queue: {
    waitForTask(): Promise<RunTask>;
    setStatus(taskId: string, status: RunTask["status"], patch?: Partial<RunTask>): void;
  };
  harness: {
    runTask(task: RunTask): Promise<void>;
  };
  heartbeatPublisher?: {
    publish(event: {
      type: "worker.heartbeat";
      workerId: string;
      at: string;
      busy: boolean;
    }): void;
  };
}

export interface WorkerLayerApi {
  start(): void;
}
