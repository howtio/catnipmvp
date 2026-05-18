import type { EnrichedRunContext } from "../06-skills/index.js";
import type { ToolCallFailedEvent, ToolCallResultEvent } from "../08-eventbus/index.js";
import type { AvailableTool, RunnerProvider } from "./provider.js";
import type { RunnerRunResult } from "./planner.js";

export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent>;
  };
  toolRegistry: { listTools(): AvailableTool[] };
  provider: RunnerProvider;
}

export interface RunnerLayerApi {
  run(context: EnrichedRunContext): Promise<RunnerRunResult>;
}
