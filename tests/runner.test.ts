import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalAnswer,
  createRunnerLayer,
  createHeuristicRunnerProvider,
  createRunnerProviderFromEnv,
  summarizeToolOutcome,
} from "../src/layers/07-runner/index.js";

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
  }, [
    { name: "write_file", description: "Write file", permission: "medium" },
    { name: "patch_file", description: "Patch file", permission: "medium" },
    { name: "shell_exec", description: "Shell exec", permission: "medium" },
  ]);

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

test("createRunnerProviderFromEnv falls back to heuristic in auto mode without key", async () => {
  const provider = createRunnerProviderFromEnv({
    CATNIP_RUNNER_PROVIDER: "auto",
  });

  const plan = await provider.plan({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "list files",
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
  }, [{ name: "list_files", description: "List files", permission: "low" }]);

  assert.equal(plan.plannedToolCalls[0]?.toolName, "list_files");
});

test("createRunnerProviderFromEnv accepts deepseek mode when key exists", () => {
  const provider = createRunnerProviderFromEnv({
    CATNIP_RUNNER_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "test-key",
  });

  assert.equal(typeof provider.plan, "function");
});

test("runner stops planned execution at configured max steps", async () => {
  const publishedEvents: Array<{ type: string; [key: string]: unknown }> = [];
  const runner = createRunnerLayer({
    eventbus: {
      publish(event) {
        publishedEvents.push(event);
      },
      async waitForToolResult() {
        return {
          type: "tool.call.result",
          runId: "run_test",
          toolCallId: "toolcall_test",
          ok: true,
          result: { ok: true },
        };
      },
    },
    toolRegistry: {
      listTools() {
        return [
          { name: "write_file", description: "Write file", permission: "medium" },
          { name: "patch_file", description: "Patch file", permission: "medium" },
          { name: "shell_exec", description: "Shell exec", permission: "medium" },
        ];
      },
    },
    provider: createHeuristicRunnerProvider(),
    limits: {
      maxSteps: 2,
    },
  });

  await assert.rejects(
    runner.run({
      runId: "run_test",
      task: {
        id: "task_test",
        sessionId: "session_test",
        input: "write file then patch file and shell status",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      docs: { coreDocuments: [] },
      workspace: { root: "/workspace", topLevelEntries: [], layerDirectories: [] },
      sessionHistory: [],
      systemPrompt: "prompt",
      skills: [],
      skillNames: [],
      skillInstructions: "",
    }),
    /step limit reached/i,
  );

  assert.equal(publishedEvents.filter((event) => event.type === "tool.call.requested").length, 2);
});

test("runner can continue after tool failure when configured", async () => {
  let callCount = 0;
  const runner = createRunnerLayer({
    eventbus: {
      publish() {},
      async waitForToolResult() {
        callCount += 1;
        if (callCount === 1) {
          return {
            type: "tool.call.failed",
            runId: "run_test",
            toolCallId: "toolcall_test",
            ok: false,
            error: "simulated failure",
          };
        }
        return {
          type: "tool.call.result",
          runId: "run_test",
          toolCallId: "toolcall_test",
          ok: true,
          result: { ok: true },
        };
      },
    },
    toolRegistry: {
      listTools() {
        return [
          { name: "write_file", description: "Write file", permission: "medium" },
          { name: "patch_file", description: "Patch file", permission: "medium" },
        ];
      },
    },
    provider: {
      async plan() {
        return {
          plannedToolCalls: [
            {
              toolName: "write_file",
              permission: "medium",
              args: { path: "a.txt", content: "a" },
              reason: "first",
            },
            {
              toolName: "patch_file",
              permission: "medium",
              args: { path: "a.txt", search: "a", replace: "b" },
              reason: "second",
            },
          ],
          finalAnswerPrompt: "summarize",
        };
      },
    },
    limits: {
      continueOnToolError: true,
    },
  });

  const result = await runner.run({
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: "update file",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    docs: { coreDocuments: [] },
    workspace: { root: "/workspace", topLevelEntries: [], layerDirectories: [] },
    sessionHistory: [],
    systemPrompt: "prompt",
    skills: [],
    skillNames: [],
    skillInstructions: "",
  });

  assert.equal(result.stepsUsed, 2);
  assert.equal(result.toolSummaries.length, 2);
  assert.equal(result.toolSummaries[0]?.ok, false);
  assert.equal(result.toolSummaries[1]?.ok, true);
});
