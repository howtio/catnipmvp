import type { EnrichedRunContext } from "../06-skills/index.js";
import type { ToolCallFailedEvent, ToolCallResultEvent } from "../08-eventbus/index.js";

export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent>;
  };
  toolRegistry: {
    listTools(): Array<{ name: string; description: string; permission: string }>;
  };
}

export interface RunnerLayerApi {
  run(context: EnrichedRunContext): Promise<void>;
}
