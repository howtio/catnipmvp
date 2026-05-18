import type { CatnipEvent } from "../../shared/types/event.js";

export type EventBusEvent = CatnipEvent | { type: string; [key: string]: unknown };

export interface ToolCallResultEvent {
  type: "tool.call.result";
  runId: string;
  toolCallId: string;
  ok: true;
  result: unknown;
}

export interface ToolCallFailedEvent {
  type: "tool.call.failed";
  runId: string;
  toolCallId: string;
  ok: false;
  error: string;
}

export interface EventBusLayerApi {
  start?(): void;
  publish(event: EventBusEvent): void;
  subscribe(eventType: string, listener: (event: EventBusEvent) => void): () => void;
  waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent>;
}
