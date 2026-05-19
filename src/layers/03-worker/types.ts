import type { RunTask } from "../../shared/types/runTask.js";
import type { RunFinalReport } from "../04-harness/index.js";

export interface WorkerLayerDeps {
  queue: {
    waitForTask(): Promise<RunTask>;
    setStatus(taskId: string, status: RunTask["status"], patch?: Partial<RunTask>): void;
  };
  harness: {
    runTask(task: RunTask): Promise<RunFinalReport>;
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
