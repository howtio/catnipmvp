import type { EnrichedRunContext } from "../06-skills/index.js";
import type { ToolCallFailedEvent, ToolCallResultEvent } from "../08-eventbus/index.js";
import type { RunnerProvider } from "./provider.js";
import type { ToolExecutionSummary } from "./planner.js";

export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    waitForToolResult(runId: string, toolCallId: string): Promise<ToolCallResultEvent | ToolCallFailedEvent>;
  };
  toolRegistry: {
    listTools(): Array<{ name: string; description: string; permission: string }>;
  };
  provider: RunnerProvider;
}

export interface RunnerRunResult {
  stepsUsed: number;
  finalAnswer: string;
  toolSummaries: ToolExecutionSummary[];
}

export interface RunnerLayerApi {
  run(context: EnrichedRunContext): Promise<RunnerRunResult>;
}
