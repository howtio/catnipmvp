import type {
  MemoryEntry,
  MemoryEnrichedRunContext,
  MemoryLayerApi,
  MemoryLayerDeps,
  RememberRunInput,
} from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";

const DEFAULT_MAX_ENTRIES = 5;

function toSessionHistoryEntry(entry: MemoryEntry): string {
  const answerPreview = entry.finalAnswer.trim().length > 0 ? entry.finalAnswer.trim().slice(0, 240) : "(no final answer)";
  return [
    `Task: ${entry.taskInput}`,
    `Answer: ${answerPreview}`,
    `Steps: ${entry.stepsUsed}`,
    `Tools: ${entry.toolSummaryCount}`,
    `Success: ${entry.success}`,
  ].join(" | ");
}

function buildMemorySummary(entries: MemoryEntry[]): string {
  if (entries.length === 0) {
    return "No prior session memory is available.";
  }

  const lines = entries.map((entry, index) => {
    const answerPreview = entry.finalAnswer.trim().length > 0 ? entry.finalAnswer.trim().slice(0, 180) : "(no final answer)";
    return `${index + 1}. task="${entry.taskInput}" steps=${entry.stepsUsed} tools=${entry.toolSummaryCount} success=${entry.success} answer="${answerPreview}"`;
  });

  return ["Recent session memory:", ...lines].join("\n");
}

export function createMemoryLayer(deps: MemoryLayerDeps = {}): MemoryLayerApi {
  const maxEntries = deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const sessionMemory = new Map<string, MemoryEntry[]>();

  return {
    async hydrateContext(context: EnrichedRunContext): Promise<MemoryEnrichedRunContext> {
      const recentEntries = [...(sessionMemory.get(context.task.sessionId) ?? [])];
      const summary = buildMemorySummary(recentEntries);
      const sessionHistory = [
        ...context.sessionHistory,
        ...recentEntries.map((entry) => toSessionHistoryEntry(entry)),
      ];

      return {
        ...context,
        sessionHistory,
        systemPrompt: [context.systemPrompt, "Session memory follows.", summary].join("\n\n"),
        memory: {
          sessionId: context.task.sessionId,
          recentEntries,
          summary,
        },
      };
    },

    async rememberRun(input: RememberRunInput): Promise<void> {
      const entry: MemoryEntry = {
        runId: input.runId,
        taskId: input.taskId,
        taskInput: input.taskInput,
        finalAnswer: input.finalAnswer,
        stepsUsed: input.stepsUsed,
        toolSummaryCount: input.toolSummaryCount,
        success: input.success,
        recordedAt: new Date().toISOString(),
      };
      const existingEntries = sessionMemory.get(input.sessionId) ?? [];
      const nextEntries = [...existingEntries, entry].slice(-maxEntries);
      sessionMemory.set(input.sessionId, nextEntries);
    },
  };
}
