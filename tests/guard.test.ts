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
