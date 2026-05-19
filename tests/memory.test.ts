import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryLayer } from "../src/layers/06.5-memory/index.js";

test("memory layer hydrates remembered session entries into context", async () => {
  const memory = createMemoryLayer();

  await memory.rememberRun({
    runId: "run_prev",
    taskId: "task_prev",
    sessionId: "session_test",
    taskInput: "read README",
    finalAnswer: "README inspected.",
    stepsUsed: 1,
    toolSummaryCount: 1,
    success: true,
  });

  const context = await memory.hydrateContext({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "continue",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    docs: { coreDocuments: [] },
    workspace: { root: "/workspace", topLevelEntries: [], layerDirectories: [] },
    sessionHistory: [],
    systemPrompt: "base prompt",
    skills: [],
    skillNames: [],
    skillInstructions: "",
  });

  assert.equal(context.memory.recentEntries.length, 1);
  assert.match(context.memory.summary, /Recent session memory/);
  assert.match(context.systemPrompt, /README inspected/);
  assert.equal(context.sessionHistory.length, 1);
});

test("memory layer trims old entries by maxEntries", async () => {
  const memory = createMemoryLayer({ maxEntries: 2 });

  await memory.rememberRun({
    runId: "run_1",
    taskId: "task_1",
    sessionId: "session_test",
    taskInput: "task 1",
    finalAnswer: "answer 1",
    stepsUsed: 1,
    toolSummaryCount: 1,
    success: true,
  });
  await memory.rememberRun({
    runId: "run_2",
    taskId: "task_2",
    sessionId: "session_test",
    taskInput: "task 2",
    finalAnswer: "answer 2",
    stepsUsed: 1,
    toolSummaryCount: 1,
    success: true,
  });
  await memory.rememberRun({
    runId: "run_3",
    taskId: "task_3",
    sessionId: "session_test",
    taskInput: "task 3",
    finalAnswer: "answer 3",
    stepsUsed: 1,
    toolSummaryCount: 1,
    success: true,
  });

  const context = await memory.hydrateContext({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "continue",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    docs: { coreDocuments: [] },
    workspace: { root: "/workspace", topLevelEntries: [], layerDirectories: [] },
    sessionHistory: [],
    systemPrompt: "base prompt",
    skills: [],
    skillNames: [],
    skillInstructions: "",
  });

  assert.deepEqual(
    context.memory.recentEntries.map((entry) => entry.taskInput),
    ["task 2", "task 3"],
  );
});
