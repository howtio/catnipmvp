import type { ExecutorLayerApi, ExecutorLayerDeps } from "./types.js";

export function createExecutorLayer(deps: ExecutorLayerDeps): ExecutorLayerApi {
  return {
    start(): void {
      deps.eventbus.publish({
        type: "executor.started",
        toolCount: deps.toolRegistry.listTools().length,
      });
    },
  };
}
