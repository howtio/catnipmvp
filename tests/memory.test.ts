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
    toolSummaries: [
      {
        toolName: "read_file",
        ok: true,
        reason: "read readme",
        result: { path: "README.md", content: "# readme" },
      },
    ],
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
  assert.equal(context.memory.workingSet.focusedFilePath, "README.md");
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
    toolSummaries: [],
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
    toolSummaries: [],
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
    toolSummaries: [],
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

test("memory layer extracts focused openable html artifact from tool results", async () => {
  const memory = createMemoryLayer();

  await memory.rememberRun({
    runId: "run_game",
    taskId: "task_game",
    sessionId: "session_test",
    taskInput: "write and open jump game",
    finalAnswer: "game opened",
    stepsUsed: 3,
    toolSummaryCount: 3,
    success: true,
    toolSummaries: [
      {
        toolName: "write_file",
        ok: true,
        reason: "write game",
        result: { path: "workspaces/demo/jump_game.html", created: true },
      },
      {
        toolName: "open_browser",
        ok: true,
        reason: "open game",
        result: { path: "workspaces/demo/jump_game.html", command: "xdg-open", argv: [] },
      },
      {
        toolName: "list_files",
        ok: true,
        reason: "list demo",
        result: {
          path: "workspaces/demo",
          entries: [
            { name: "jump_game.html", type: "file" },
            { name: "hello.html", type: "file" },
          ],
        },
      },
    ],
  });

  const context = await memory.hydrateContext({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "打开这个游戏",
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

  assert.equal(context.memory.workingSet.focusedOpenableHtmlPath, "workspaces/demo/jump_game.html");
  assert.ok(context.memory.workingSet.openableHtmlPaths.includes("workspaces/demo/jump_game.html"));
  assert.match(context.memory.summary, /Focused openable HTML: workspaces\/demo\/jump_game.html/);
});
