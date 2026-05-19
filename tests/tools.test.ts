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
    created: true,
    bytesWritten: 8,
    preview: "written\n",
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
    search: "alpha",
    replace: "omega",
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

test("executeToolCall open_browser opens a workspace html file", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  mkdirSync(join(workspaceRoot, "workspaces"), { recursive: true });
  mkdirSync(join(workspaceRoot, "workspaces", "demo"), { recursive: true });
  writeFileSync(join(workspaceRoot, "workspaces", "demo", "index.html"), "<!doctype html>", "utf8");
  const previousOverride = process.env.CATNIP_BROWSER_OPEN_BIN;
  process.env.CATNIP_BROWSER_OPEN_BIN = "true";

  try {
    const result = await executeToolCall({
      workspaceRoot,
      tool: {
        name: "open_browser",
        description: "Open browser",
        permission: "medium",
        category: "browser",
        argShape: "object",
        stage: "active",
      },
      args: {
        path: "workspaces/demo/index.html",
      },
    });

    assert.deepEqual(result, {
      path: "workspaces/demo/index.html",
      command: "true",
      argv: [join(workspaceRoot, "workspaces", "demo", "index.html")],
    });
  } finally {
    if (previousOverride === undefined) {
      delete process.env.CATNIP_BROWSER_OPEN_BIN;
    } else {
      process.env.CATNIP_BROWSER_OPEN_BIN = previousOverride;
    }
  }
});

test("executeToolCall web_search returns parsed search results", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.CATNIP_WEB_SEARCH_BASE_URL;
  process.env.CATNIP_WEB_SEARCH_BASE_URL = "https://example.test/search";
  globalThis.fetch = async () =>
    new Response(
      [
        '<html><body>',
        '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone">Example One</a>',
        '<a class="result__a" href="https://example.com/two">Example Two</a>',
        "</body></html>",
      ].join(""),
      { status: 200 },
    );

  try {
    const result = await executeToolCall({
      workspaceRoot,
      tool: {
        name: "web_search",
        description: "Web search",
        permission: "medium",
        category: "web",
        argShape: "object",
        stage: "active",
      },
      args: {
        query: "catnip agent",
        limit: 2,
      },
    });

    assert.deepEqual(result, {
      query: "catnip agent",
      engine: "duckduckgo-html",
      results: [
        { title: "Example One", url: "https://example.com/one" },
        { title: "Example Two", url: "https://example.com/two" },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.CATNIP_WEB_SEARCH_BASE_URL;
    } else {
      process.env.CATNIP_WEB_SEARCH_BASE_URL = originalBaseUrl;
    }
  }
});

test("executeToolCall open_browser_search opens search url in browser", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "catnip-tools-"));
  const previousOpenOverride = process.env.CATNIP_BROWSER_OPEN_BIN;
  const previousSearchBase = process.env.CATNIP_BROWSER_SEARCH_URL_BASE;
  process.env.CATNIP_BROWSER_OPEN_BIN = "true";
  process.env.CATNIP_BROWSER_SEARCH_URL_BASE = "https://example.com/search";

  try {
    const result = await executeToolCall({
      workspaceRoot,
      tool: {
        name: "open_browser_search",
        description: "Open browser search",
        permission: "medium",
        category: "browser",
        argShape: "object",
        stage: "active",
      },
      args: {
        query: "catnip agent",
      },
    });

    assert.deepEqual(result, {
      query: "catnip agent",
      url: "https://example.com/search?q=catnip+agent",
      command: "true",
      argv: ["https://example.com/search?q=catnip+agent"],
    });
  } finally {
    if (previousOpenOverride === undefined) {
      delete process.env.CATNIP_BROWSER_OPEN_BIN;
    } else {
      process.env.CATNIP_BROWSER_OPEN_BIN = previousOpenOverride;
    }
    if (previousSearchBase === undefined) {
      delete process.env.CATNIP_BROWSER_SEARCH_URL_BASE;
    } else {
      process.env.CATNIP_BROWSER_SEARCH_URL_BASE = previousSearchBase;
    }
  }
});
