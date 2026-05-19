import type { RunTask } from "../../shared/types/runTask.js";
import type { RunFinalReport } from "../04-harness/index.js";

export interface WorkerLayerDeps {
  queue: {
    waitForTask(): Promise<RunTask>;
    setStatus(taskId: string, status: RunTask["status"], patch?: Partial<RunTask>): void;
    size(): number;
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
      workerCount: number;
      activeWorkers: number;
      idleWorkers: number;
      queueDepth: number;
      completedTasks: number;
      failedTasks: number;
    }): void;
  };
  config?: Partial<WorkerLayerConfig>;
}

export interface WorkerLayerConfig {
  workerCount: number;
  heartbeatIntervalMs: number;
}

export interface WorkerLayerApi {
  start(): void;
}
