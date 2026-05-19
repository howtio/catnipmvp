import type { WorkerLayerApi, WorkerLayerDeps } from "./types.js";
import { createId } from "../../shared/utils/createId.js";
import { TimeoutError } from "../../shared/errors/TimeoutError.js";

const DEFAULT_WORKER_COUNT = 1;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 1000;

export function createWorkerLayer(deps: WorkerLayerDeps): WorkerLayerApi {
  const workerId = createId("worker");
  const workerCount = Math.max(1, deps.config?.workerCount ?? DEFAULT_WORKER_COUNT);
  const heartbeatIntervalMs = Math.max(1, deps.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);
  let started = false;
  let activeWorkers = 0;
  let completedTasks = 0;
  let failedTasks = 0;

  function publishHeartbeat(): void {
    deps.heartbeatPublisher?.publish({
      type: "worker.heartbeat",
      workerId,
      at: new Date().toISOString(),
      busy: activeWorkers > 0,
      workerCount,
      activeWorkers,
      idleWorkers: Math.max(0, workerCount - activeWorkers),
      queueDepth: deps.queue.size(),
      completedTasks,
      failedTasks,
    });
  }

  async function consumeLoop(slotNumber: number): Promise<void> {
    for (;;) {
      const task = await deps.queue.waitForTask();

      void slotNumber;
      activeWorkers += 1;
      deps.queue.setStatus(task.id, "running", {
        startedAt: new Date().toISOString(),
      });
      publishHeartbeat();

      try {
        const report = await deps.harness.runTask(task);
        completedTasks += 1;
        deps.queue.setStatus(task.id, "done", {
          runId: report.runId,
          finishedAt: new Date().toISOString(),
          finalAnswer: report.finalAnswer,
          stepsUsed: report.stepsUsed,
          toolSummaryCount: report.toolSummaryCount,
        });
      } catch (error: unknown) {
        failedTasks += 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.queue.setStatus(task.id, "failed", {
          finishedAt: new Date().toISOString(),
          failureKind: error instanceof TimeoutError ? "timeout" : "runtime",
          errorMessage,
        });
      } finally {
        activeWorkers = Math.max(0, activeWorkers - 1);
        publishHeartbeat();
      }
    }
  }

  return {
    start(): void {
      if (started) {
        return;
      }

      started = true;
      publishHeartbeat();
      setInterval(publishHeartbeat, heartbeatIntervalMs).unref();
      for (let slotNumber = 1; slotNumber <= workerCount; slotNumber += 1) {
        void consumeLoop(slotNumber);
      }
      console.log(`[worker] started ${workerId} slots=${workerCount}`);
    },
  };
}
