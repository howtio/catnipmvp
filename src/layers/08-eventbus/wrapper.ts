import { EventEmitter } from "node:events";
import type { EventBusLayerApi } from "./types.js";
import type { EventBusEvent, ToolCallFailedEvent, ToolCallResultEvent } from "./types.js";
import type { JsonlLogger } from "../../shared/logger/jsonlLogger.js";

function isToolCallResultEvent(event: EventBusEvent): event is ToolCallResultEvent {
  return event.type === "tool.call.result";
}

function isToolCallFailedEvent(event: EventBusEvent): event is ToolCallFailedEvent {
  return event.type === "tool.call.failed";
}

export interface CreateEventBusLayerOptions {
  logger?: JsonlLogger;
}

export function createEventBusLayer(options: CreateEventBusLayerOptions = {}): EventBusLayerApi {
  const emitter = new EventEmitter();

  return {
    publish(event: EventBusEvent): void {
      options.logger?.write({
        ts: new Date().toISOString(),
        event: event.type,
        payload: event,
      });
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
