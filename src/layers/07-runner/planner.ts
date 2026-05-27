import type { ToolCallFailedEvent, ToolCallResultEvent } from "../08-eventbus/index.js";
import type { PlannedToolCall } from "./provider.js";

export interface ToolExecutionSummary {
  toolName: string;
  ok: boolean;
  reason: string;
  result?: unknown;
  error?: string;
}

export interface RunnerRunResult {
  stepsUsed: number;
  finalAnswer: string;
  toolSummaries: ToolExecutionSummary[];
}

function unwrapExecutorResult(result: unknown): unknown {
  // Executor wraps actual tool result in { toolName, permission, category, stage, payload }.
  // Unwrap to get the real result (path, content, etc.) for memory extraction and final answer.
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    const record = result as Record<string, unknown>;
    if ("payload" in record) {
      return record.payload;
    }
  }
  return result;
}

export function summarizeToolOutcome(
  plannedCall: PlannedToolCall,
  outcome: ToolCallResultEvent | ToolCallFailedEvent,
): ToolExecutionSummary {
  if (outcome.ok) {
    return {
      toolName: plannedCall.toolName,
      ok: true,
      reason: plannedCall.reason,
      result: unwrapExecutorResult(outcome.result),
    };
  }

  return {
    toolName: plannedCall.toolName,
    ok: false,
    reason: plannedCall.reason,
    error: outcome.error,
  };
}

export function buildFinalAnswer(toolSummaries: ToolExecutionSummary[]): string {
  if (toolSummaries.length === 0) {
    return "No tool calls were executed.";
  }

  const parts = toolSummaries.map((summary) => {
    if (!summary.ok) {
      return `${summary.toolName}: failed (${summary.error ?? "unknown error"})`;
    }

    return `${summary.toolName}: ok`;
  });

  return `Executed ${toolSummaries.length} tool call(s). ${parts.join("; ")}.`;
}
