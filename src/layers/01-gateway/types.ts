import type { RunTask } from "../../shared/types/runTask.js";
import type { QueueTaskSnapshot } from "../02-queue/index.js";
import type { EventBusEvent } from "../08-eventbus/index.js";

export interface GatewayLayerDeps {
  queue: {
    enqueue(task: RunTask): Promise<void>;
    waitForCompletion(taskId: string): Promise<QueueTaskSnapshot>;
  };
  eventbus?: {
    subscribe(eventType: string, listener: (event: EventBusEvent) => void): () => void;
  };
}

export interface GatewayLayerApi {
  startCli(): Promise<void>;
}
