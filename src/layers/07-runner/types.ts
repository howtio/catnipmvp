import type { MemoryEnrichedRunContext } from "../06.5-memory/index.js";
import type { ToolCallFailedEvent, ToolCallResultEvent } from "../08-eventbus/index.js";
import type { AvailableTool, RunnerProvider } from "./provider.js";
import type { RunnerRunResult } from "./planner.js";

export interface RunnerExecutionLimits {
  maxSteps: number;
  continueOnToolError: boolean;
  maxToolRetries: number;
}

export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent>;
  };
  toolRegistry: { listTools(): AvailableTool[] };
  provider: RunnerProvider;
  limits?: Partial<RunnerExecutionLimits>;
}

export interface RunnerLayerApi {
  run(context: MemoryEnrichedRunContext): Promise<RunnerRunResult>;
}
