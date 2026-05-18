import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeToolCall } from "../src/layers/10-executor/tools.js";

test("executeToolCall list_files returns directory entries", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  mkdirSync(join(workspaceRoot, "src"));
  writeFileSync(join(workspaceRoot, "README.md"), "# demo\n", "utf8");

  const result = await executeToolCall({
    workspaceRoot,
    tool: {
      name: "list_files",
      description: "List files",
      permission: "low",
      category: "filesystem",
      argShape: "object",
      stage: "active",
    },
    args: {
      path: ".",
    },
  });

  assert.deepEqual(result, {
    path: ".",
    entries: [
      { name: "README.md", type: "file" },
      { name: "src", type: "directory" },
    ],
  });
});

test("executeToolCall read_file returns file content", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  mkdirSync(join(workspaceRoot, "docs"));
  writeFileSync(join(workspaceRoot, "docs", "note.txt"), "hello\n", "utf8");

  const result = await executeToolCall({
    workspaceRoot,
    tool: {
      name: "read_file",
      description: "Read file",
      permission: "low",
      category: "filesystem",
      argShape: "object",
      stage: "active",
    },
    args: {
      path: "docs/note.txt",
    },
  });

  assert.deepEqual(result, {
    path: "docs/note.txt",
    content: "hello\n",
  });
});

test("executeToolCall write_file writes content", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));

  const result = await executeToolCall({
    workspaceRoot,
    tool: {
      name: "write_file",
      description: "Write file",
      permission: "medium",
      category: "filesystem",
      argShape: "object",
      stage: "active",
    },
    args: {
      path: "docs/out.txt",
      content: "written\n",
    },
  });

  assert.deepEqual(result, {
    path: "docs/out.txt",
    bytesWritten: 8,
  });
});

test("executeToolCall patch_file replaces matching content", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  mkdirSync(join(workspaceRoot, "docs"));
  writeFileSync(join(workspaceRoot, "docs", "patch.txt"), "alpha beta alpha\n", "utf8");

  const result = await executeToolCall({
    workspaceRoot,
    tool: {
      name: "patch_file",
      description: "Patch file",
      permission: "medium",
      category: "filesystem",
      argShape: "object",
      stage: "active",
    },
    args: {
      path: "docs/patch.txt",
      search: "alpha",
      replace: "omega",
    },
  });

  assert.deepEqual(result, {
    path: "docs/patch.txt",
    replacements: 2,
  });
});

test("executeToolCall shell_exec runs a guarded command payload", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));

  const result = await executeToolCall({
    workspaceRoot,
    tool: {
      name: "shell_exec",
      description: "Shell exec",
      permission: "medium",
      category: "shell",
      argShape: "object",
      stage: "active",
    },
    args: {
      command: "ls",
      argv: [],
    },
  });

  assert.equal(typeof (result as { stdout: string }).stdout, "string");
});
