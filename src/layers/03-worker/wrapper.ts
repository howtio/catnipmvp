import type { WorkerLayerApi, WorkerLayerDeps } from "./types.js";
import { createId } from "../../shared/utils/createId.js";

const HEARTBEAT_INTERVAL_MS = 1000;

export function createWorkerLayer(deps: WorkerLayerDeps): WorkerLayerApi {
  const workerId = createId("worker");
  let started = false;
  let busy = false;

  function publishHeartbeat(): void {
    deps.heartbeatPublisher?.publish({
      type: "worker.heartbeat",
      workerId,
      at: new Date().toISOString(),
      busy,
    });
  }

  async function consumeLoop(): Promise<void> {
    for (;;) {
      const task = await deps.queue.waitForTask();

      busy = true;
      deps.queue.setStatus(task.id, "running", {
        startedAt: new Date().toISOString(),
      });
      publishHeartbeat();

      try {
        const report = await deps.harness.runTask(task);
        deps.queue.setStatus(task.id, "done", {
          runId: report.runId,
          finishedAt: new Date().toISOString(),
          finalAnswer: report.finalAnswer,
          stepsUsed: report.stepsUsed,
          toolSummaryCount: report.toolSummaryCount,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.queue.setStatus(task.id, "failed", {
          finishedAt: new Date().toISOString(),
          errorMessage,
        });
      } finally {
        busy = false;
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
      setInterval(publishHeartbeat, HEARTBEAT_INTERVAL_MS).unref();
      void consumeLoop();
      console.log(`[worker] started ${workerId}`);
    },
  };
}
