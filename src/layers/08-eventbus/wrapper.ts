import { EventEmitter } from "node:events";
import type { EventBusLayerApi } from "./types.js";
import type { EventBusEvent, ToolCallFailedEvent, ToolCallResultEvent } from "./types.js";

function isToolCallResultEvent(event: EventBusEvent): event is ToolCallResultEvent {
  return event.type === "tool.call.result";
}

function isToolCallFailedEvent(event: EventBusEvent): event is ToolCallFailedEvent {
  return event.type === "tool.call.failed";
}

export function createEventBusLayer(): EventBusLayerApi {
  const emitter = new EventEmitter();

  return {
    publish(event: EventBusEvent): void {
      emitter.emit(event.type, event);
    },
    subscribe(eventType: string, listener: (event: EventBusEvent) => void): () => void {
      emitter.on(eventType, listener);
      return () => {
        emitter.off(eventType, listener);
      };
    },
    async waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent> {
      return new Promise<ToolCallResultEvent | ToolCallFailedEvent>((resolve) => {
        const cleanup = [
          this.subscribe("tool.call.result", (event) => {
            if (!isToolCallResultEvent(event)) {
              return;
            }
            if (event.runId !== runId || event.toolCallId !== toolCallId) {
              return;
            }
            for (const unsubscribe of cleanup) {
              unsubscribe();
            }
            resolve(event);
          }),
          this.subscribe("tool.call.failed", (event) => {
            if (!isToolCallFailedEvent(event)) {
              return;
            }
            if (event.runId !== runId || event.toolCallId !== toolCallId) {
              return;
            }
            for (const unsubscribe of cleanup) {
              unsubscribe();
            }
            resolve(event);
          }),
        ];
      });
    },
  };
}
