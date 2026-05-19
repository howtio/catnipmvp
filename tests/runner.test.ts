import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalAnswer,
  createRunnerLayer,
  createHeuristicRunnerProvider,
  createRunnerProviderFromEnv,
  summarizeToolOutcome,
} from "../src/layers/07-runner/index.js";
import type { MemoryEnrichedRunContext } from "../src/layers/06.5-memory/index.js";

function createTestRunnerContext(taskInput: string): MemoryEnrichedRunContext {
  return {
    runId: "run_test",
    task: {
      id: "task_test",
      sessionId: "session_test",
      input: taskInput,
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
    memory: {
      sessionId: "session_test",
      recentEntries: [],
      summary: "No prior session memory is available.",
    },
  };
}

test("heuristic runner provider plans multiple tool calls for combined task", async () => {
  const provider = createHeuristicRunnerProvider();
  const plan = await provider.plan(createTestRunnerContext("write file then patch file and shell status"), [
    { name: "write_file", description: "Write file", permission: "medium" },
    { name: "patch_file", description: "Patch file", permission: "medium" },
    { name: "shell_exec", description: "Shell exec", permission: "medium" },
  ]);

  assert.deepEqual(
    plan.plannedToolCalls.map((step) => step.toolName),
    ["write_file", "patch_file", "shell_exec"],
  );
});

test("heuristic runner provider can plan write html then open browser", async () => {
  const provider = createHeuristicRunnerProvider();
  const plan = await provider.plan(createTestRunnerContext("create file html and open browser run html"), [
    { name: "write_file", description: "Write file", permission: "medium" },
    { name: "open_browser", description: "Open browser", permission: "medium" },
  ]);

  assert.deepEqual(
    plan.plannedToolCalls.map((step) => step.toolName),
    ["write_file", "open_browser"],
  );
  assert.equal(plan.plannedToolCalls[0]?.args.path, "workspaces/demo/generated.html");
  assert.equal(plan.plannedToolCalls[1]?.args.path, "workspaces/demo/generated.html");
});

test("heuristic runner provider can plan web search and browser search", async () => {
  const provider = createHeuristicRunnerProvider();
  const plan = await provider.plan(createTestRunnerContext("web search latest catnip agent and open browser search"), [
    { name: "web_search", description: "Web search", permission: "medium" },
    { name: "open_browser_search", description: "Open browser search", permission: "medium" },
  ]);

  assert.deepEqual(
    plan.plannedToolCalls.map((step) => step.toolName),
    ["web_search", "open_browser_search"],
  );
  assert.equal(plan.plannedToolCalls[0]?.args.query, "latest catnip agent and");
  assert.equal(plan.plannedToolCalls[1]?.args.query, "latest catnip agent and");
});

test("heuristic runner provider can plan opening a url", async () => {
  const provider = createHeuristicRunnerProvider();
  const plan = await provider.plan(createTestRunnerContext("open url https://example.com and click into it"), [
    { name: "open_url", description: "Open url", permission: "medium" },
  ]);

  assert.equal(plan.plannedToolCalls[0]?.toolName, "open_url");
  assert.equal(plan.plannedToolCalls[0]?.args.url, "https://example.com");
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

  const plan = await provider.plan(
    createTestRunnerContext("list files"),
    [{ name: "list_files", description: "List files", permission: "low" }],
  );

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
    runner.run(createTestRunnerContext("write file then patch file and shell status")),
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

  const result = await runner.run(createTestRunnerContext("update file"));

  assert.equal(result.stepsUsed, 2);
  assert.equal(result.toolSummaries.length, 2);
  assert.equal(result.toolSummaries[0]?.ok, false);
  assert.equal(result.toolSummaries[1]?.ok, true);
});
