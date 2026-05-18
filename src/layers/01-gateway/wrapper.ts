import { createId } from "../../shared/utils/createId.js";
import type { RunTask } from "../../shared/types/runTask.js";
import type { GatewayLayerApi, GatewayLayerDeps } from "./types.js";

export function createGatewayLayer(deps: GatewayLayerDeps): GatewayLayerApi {
  return {
    async startCli(): Promise<void> {
      const input = process.argv.slice(2).join(" ").trim();
      const task: RunTask = {
        id: createId("task"),
        sessionId: createId("session"),
        input: input || "Describe the next implementation step for this workspace.",
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      await deps.queue.enqueue(task);
      console.log(`[gateway] queued task ${task.id}`);

      const result = await deps.queue.waitForCompletion(task.id);
      if (result.status === "failed") {
        console.error(`[gateway] task ${task.id} failed: ${result.task.errorMessage ?? "unknown error"}`);
        process.exitCode = 1;
        return;
      }

      console.log(`[gateway] task ${task.id} completed`);
    },
  };
}
