import type { ExecutorLayerApi, ExecutorLayerDeps } from "./types.js";

export function createExecutorLayer(deps: ExecutorLayerDeps): ExecutorLayerApi {
  return {
    start(): void {
      deps.eventbus.subscribe("tool.call.requested", (event) => {
        if (event.type !== "tool.call.requested") {
          return;
        }

        const tool = deps.toolRegistry.getTool(String(event.toolName));
        if (!tool) {
          deps.eventbus.publish({
            type: "tool.call.failed",
            runId: String(event.runId),
            toolCallId: String(event.toolCallId),
            ok: false,
            error: `Unknown tool: ${String(event.toolName)}`,
          });
          return;
        }

        deps.eventbus.publish({
          type: "tool.call.result",
          runId: String(event.runId),
          toolCallId: String(event.toolCallId),
          ok: true,
          result: {
            toolName: tool.name,
            simulated: true,
            permission: tool.permission,
            args: event.args,
            message: `Executor skeleton handled ${tool.name}.`,
          },
        });
      });

      deps.eventbus.publish({
        type: "executor.started",
        toolCount: deps.toolRegistry.listTools().length,
      });
    },
  };
}
