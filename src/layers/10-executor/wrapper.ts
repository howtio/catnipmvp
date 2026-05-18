import type { ExecutorLayerApi, ExecutorLayerDeps } from "./types.js";
import { guardToolCall } from "./guard.js";
import type { ToolCallRequest } from "./types.js";
import { executeToolCall } from "./tools.js";

function isToolCallRequestEvent(event: { type: string; [key: string]: unknown }): event is ToolCallRequest {
  return event.type === "tool.call.requested";
}

export function createExecutorLayer(deps: ExecutorLayerDeps): ExecutorLayerApi {
  return {
    start(): void {
      deps.eventbus.subscribe("tool.call.requested", (event) => {
        if (!isToolCallRequestEvent(event)) {
          return;
        }

        void (async () => {
          const guardResult = guardToolCall(event, {
            workspaceRoot: deps.workspaceRoot,
            toolRegistry: deps.toolRegistry,
          });
          if (!guardResult.ok) {
            deps.eventbus.publish({
              type: "tool.call.failed",
              runId: event.runId,
              toolCallId: event.toolCallId,
              ok: false,
              error: guardResult.error,
            });
            return;
          }

          try {
            const result = await executeToolCall({
              workspaceRoot: deps.workspaceRoot,
              tool: guardResult.tool,
              args: guardResult.normalizedArgs,
            });

            deps.eventbus.publish({
              type: "tool.call.result",
              runId: event.runId,
              toolCallId: event.toolCallId,
              ok: true,
              result: {
                toolName: guardResult.tool.name,
                permission: guardResult.tool.permission,
                category: guardResult.tool.category,
                stage: guardResult.tool.stage,
                payload: result,
              },
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            deps.eventbus.publish({
              type: "tool.call.failed",
              runId: event.runId,
              toolCallId: event.toolCallId,
              ok: false,
              error: message,
            });
          }
        })();
      });

      deps.eventbus.publish({
        type: "executor.started",
        toolCount: deps.toolRegistry.listTools().length,
      });
    },
  };
}
