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
