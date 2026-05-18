import type { RunTask } from "../../shared/types/runTask.js";
import type { QueueTaskSnapshot } from "../02-queue/index.js";

export interface GatewayLayerDeps {
  queue: {
    enqueue(task: RunTask): Promise<void>;
    waitForCompletion(taskId: string): Promise<QueueTaskSnapshot>;
  };
}

export interface GatewayLayerApi {
  startCli(): Promise<void>;
}
