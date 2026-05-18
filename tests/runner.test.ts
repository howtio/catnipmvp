import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalAnswer, createHeuristicRunnerProvider, summarizeToolOutcome } from "../src/layers/07-runner/index.js";

test("heuristic runner provider plans multiple tool calls for combined task", async () => {
  const provider = createHeuristicRunnerProvider();
  const plan = await provider.plan({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "write file then patch file and shell status",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    docs: {
      coreDocuments: [],
    },
    workspace: {
      root: "/workspace",
      topLevelEntries: [],
      layerDirectories: [],
    },
    sessionHistory: [],
    systemPrompt: "prompt",
    skills: [],
    skillNames: [],
    skillInstructions: "",
  });

  assert.deepEqual(
    plan.plannedToolCalls.map((step) => step.toolName),
    ["write_file", "patch_file", "shell_exec"],
  );
});

test("summarizeToolOutcome and buildFinalAnswer produce readable output", () => {
  const summary = summarizeToolOutcome(
    {
      toolName: "list_files",
      permission: "low",
      args: { path: "." },
      reason: "Inspect workspace.",
    },
    {
      type: "tool.call.result",
      runId: "run_test",
      toolCallId: "toolcall_test",
      ok: true,
      result: { entries: [] },
    },
  );

  assert.equal(summary.ok, true);
  assert.equal(buildFinalAnswer([summary]), "Executed 1 tool call(s). list_files: ok.");
});
