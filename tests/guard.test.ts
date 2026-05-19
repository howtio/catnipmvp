import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { guardToolCall } from "../src/layers/10-executor/guard.js";

test("guardToolCall rejects read_file paths outside workspace", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "read_file",
      permission: "low",
      workspaceRoot,
      args: {
        path: "../outside.txt",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "read_file"
            ? {
                name: "read_file",
                description: "Read a file.",
                permission: "low",
                category: "filesystem",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /outside the active workspace/);
  }
});

test("guardToolCall accepts read_file paths inside workspace", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "read_file",
      permission: "low",
      workspaceRoot,
      args: {
        path: "docs/input.txt",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "read_file"
            ? {
                name: "read_file",
                description: "Read a file.",
                permission: "low",
                category: "filesystem",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, true);
});

test("guardToolCall rejects non-whitelisted shell_exec commands", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "shell_exec",
      permission: "medium",
      workspaceRoot,
      args: {
        command: "rm",
        argv: ["-rf", "."],
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "shell_exec"
            ? {
                name: "shell_exec",
                description: "Shell exec.",
                permission: "medium",
                category: "shell",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /not allowed/);
  }
});

test("guardToolCall accepts open_browser for workspace html file", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_browser",
      permission: "medium",
      workspaceRoot,
      args: {
        path: "workspaces/demo/index.html",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_browser"
            ? {
                name: "open_browser",
                description: "Open browser.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, true);
});

test("guardToolCall rejects open_browser for non-html file", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_browser",
      permission: "medium",
      workspaceRoot,
      args: {
        path: "workspaces/demo/index.txt",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_browser"
            ? {
                name: "open_browser",
                description: "Open browser.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /\.html|\.htm/);
  }
});

test("guardToolCall rejects open_browser outside workspaces demo", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_browser",
      permission: "medium",
      workspaceRoot,
      args: {
        path: "index.html",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_browser"
            ? {
                name: "open_browser",
                description: "Open browser.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /workspaces\/demo/);
  }
});

test("guardToolCall accepts web_search with limit", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "web_search",
      permission: "medium",
      workspaceRoot,
      args: {
        query: "latest catnip agent runtime",
        limit: 5,
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "web_search"
            ? {
                name: "web_search",
                description: "Web search.",
                permission: "medium",
                category: "web",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, true);
});

test("guardToolCall rejects open_browser_search with empty query", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_browser_search",
      permission: "medium",
      workspaceRoot,
      args: {
        query: "   ",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_browser_search"
            ? {
                name: "open_browser_search",
                description: "Browser search.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /non-empty query/);
  }
});

test("guardToolCall accepts open_url for https link", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_url",
      permission: "medium",
      workspaceRoot,
      args: {
        url: "https://example.com/result",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_url"
            ? {
                name: "open_url",
                description: "Open url.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, true);
});

test("guardToolCall rejects open_url for file protocol", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-guard-"));
  const result = guardToolCall(
    {
      type: "tool.call.requested",
      runId: "run_test",
      toolCallId: "toolcall_test",
      toolName: "open_url",
      permission: "medium",
      workspaceRoot,
      args: {
        url: "file:///tmp/test.html",
      },
    },
    {
      workspaceRoot,
      toolRegistry: {
        getTool(name) {
          return name === "open_url"
            ? {
                name: "open_url",
                description: "Open url.",
                permission: "medium",
                category: "browser",
                argShape: "object",
                stage: "active",
              }
            : undefined;
        },
      },
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /http or https/);
  }
});
