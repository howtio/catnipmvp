import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createHarnessLayer } from "../src/layers/04-harness/index.js";
import { TimeoutError } from "../src/shared/errors/TimeoutError.js";

test("harness fails a run when runner exceeds timeout", async () => {
  const publishedEvents: Array<{ type: string; [key: string]: unknown }> = [];
  const reports: Array<Record<string, unknown>> = [];
  const harness = createHarnessLayer({
    context: {
      async buildContext(runId, task) {
        return {
          runId,
          task,
          docs: { coreDocuments: [] },
          workspace: { root: "/workspace", topLevelEntries: [], layerDirectories: [] },
          sessionHistory: [],
          systemPrompt: "prompt",
        };
      },
    },
    skills: {
      async injectSkills(context) {
        return {
          ...context,
          skills: [],
          skillNames: [],
          skillInstructions: "",
        };
      },
    },
    runner: {
      async run() {
        await delay(50);
        return {
          stepsUsed: 1,
          finalAnswer: "late answer",
          toolSummaries: [],
        };
      },
    },
    eventbus: {
      publish(event) {
        publishedEvents.push(event);
      },
    },
    reportLogger: {
      write(entry) {
        reports.push(entry);
      },
    },
    limits: {
      runTimeoutMs: 10,
    },
  });

  await assert.rejects(
    harness.runTask({
      id: "task_test",
      sessionId: "session_test",
      input: "slow task",
      status: "pending",
      createdAt: new Date().toISOString(),
    }),
    TimeoutError,
  );

  const finishedEvent = publishedEvents.find((event) => event.type === "run.finished");
  assert.equal(finishedEvent?.failureKind, "timeout");
  assert.match(String(finishedEvent?.errorMessage), /timeout/i);
  assert.equal(reports.length, 1);
});
