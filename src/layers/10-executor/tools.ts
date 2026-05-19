import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { platform } from "node:process";
import { ToolError } from "../../shared/errors/ToolError.js";
import type { ToolDefinition } from "../../shared/types/tool.js";

const execFileAsync = promisify(execFile);

export interface ExecuteToolCallArgs {
  workspaceRoot: string;
  tool: ToolDefinition;
  args: unknown;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new ToolError("Tool args must be a plain object.");
}

async function executeListFiles(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  const relativePath = typeof input.path === "string" && input.path.length > 0 ? input.path : ".";
  const targetPath = join(workspaceRoot, relativePath);
  const entries = await readdir(targetPath, { withFileTypes: true });

  return {
    path: relativePath,
    entries: entries
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

async function executeReadFile(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.path !== "string" || input.path.length === 0) {
    throw new ToolError("read_file requires a non-empty path.");
  }

  const targetPath = join(workspaceRoot, input.path);
  const content = await readFile(targetPath, "utf8");

  return {
    path: input.path,
    content,
  };
}

async function executeWriteFile(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.path !== "string" || input.path.length === 0) {
    throw new ToolError("write_file requires a non-empty path.");
  }
  if (typeof input.content !== "string") {
    throw new ToolError("write_file requires string content.");
  }

  const targetPath = join(workspaceRoot, input.path);
  let previousContent: string | undefined;
  try {
    previousContent = await readFile(targetPath, "utf8");
  } catch {
    previousContent = undefined;
  }
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.content, "utf8");

  return {
    path: input.path,
    created: typeof previousContent !== "string",
    bytesWritten: Buffer.byteLength(input.content, "utf8"),
    preview: input.content.slice(0, 160),
  };
}

async function executePatchFile(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.path !== "string" || input.path.length === 0) {
    throw new ToolError("patch_file requires a non-empty path.");
  }
  if (typeof input.search !== "string" || input.search.length === 0) {
    throw new ToolError("patch_file requires a non-empty search string.");
  }
  if (typeof input.replace !== "string") {
    throw new ToolError("patch_file requires a string replace value.");
  }

  const targetPath = join(workspaceRoot, input.path);
  const original = await readFile(targetPath, "utf8");
  const occurrences = original.split(input.search).length - 1;
  if (occurrences === 0) {
    throw new ToolError("patch_file search string not found.");
  }

  const next = original.replaceAll(input.search, input.replace);
  await writeFile(targetPath, next, "utf8");

  return {
    path: input.path,
    replacements: occurrences,
    search: input.search,
    replace: input.replace,
  };
}

async function executeGitDiff(workspaceRoot: string): Promise<unknown> {
  const { stdout } = await execFileAsync("git", ["diff", "--no-ext-diff", "--minimal"], {
    cwd: workspaceRoot,
    maxBuffer: 1024 * 1024,
  });

  return {
    command: "git diff --no-ext-diff --minimal",
    output: stdout,
  };
}

async function executeShellExec(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.command !== "string" || input.command.length === 0) {
    throw new ToolError("shell_exec requires a command string.");
  }

  const argv =
    Array.isArray(input.argv) && input.argv.every((value) => typeof value === "string")
      ? (input.argv as string[])
      : [];
  const { stdout, stderr } = await execFileAsync(input.command, argv, {
    cwd: workspaceRoot,
    maxBuffer: 1024 * 1024,
  });

  return {
    command: input.command,
    argv,
    stdout,
    stderr,
  };
}

function resolveBrowserOpenCommand(targetPath: string): { command: string; argv: string[] } {
  const override = process.env.CATNIP_BROWSER_OPEN_BIN;
  if (typeof override === "string" && override.length > 0) {
    return {
      command: override,
      argv: [targetPath],
    };
  }

  switch (platform) {
    case "darwin":
      return { command: "open", argv: [targetPath] };
    case "win32":
      return { command: "cmd", argv: ["/c", "start", "", targetPath] };
    default:
      return { command: "xdg-open", argv: [targetPath] };
  }
}

async function executeOpenBrowser(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.path !== "string" || input.path.length === 0) {
    throw new ToolError("open_browser requires a non-empty path.");
  }

  const targetPath = join(workspaceRoot, input.path);
  await readFile(targetPath, "utf8");
  const openCommand = resolveBrowserOpenCommand(targetPath);
  await execFileAsync(openCommand.command, openCommand.argv, {
    cwd: workspaceRoot,
    maxBuffer: 1024 * 1024,
  });

  return {
    path: input.path,
    command: openCommand.command,
    argv: openCommand.argv,
  };
}

async function executeOpenUrl(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.url !== "string" || input.url.trim().length === 0) {
    throw new ToolError("open_url requires a non-empty url.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    throw new ToolError("open_url requires a valid absolute URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ToolError("open_url only allows http or https URLs.");
  }

  const targetUrl = parsedUrl.toString();
  const openCommand = resolveBrowserOpenCommand(targetUrl);
  await execFileAsync(openCommand.command, openCommand.argv, {
    cwd: workspaceRoot,
    maxBuffer: 1024 * 1024,
  });

  return {
    url: targetUrl,
    command: openCommand.command,
    argv: openCommand.argv,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)));
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeSearchHref(href: string): string {
  try {
    const decodedHref = decodeHtmlEntities(href);
    const parsedUrl = new URL(decodedHref, "https://html.duckduckgo.com");
    const redirectTarget = parsedUrl.searchParams.get("uddg");
    return redirectTarget ? decodeURIComponent(redirectTarget) : parsedUrl.toString();
  } catch {
    return decodeHtmlEntities(href);
  }
}

function parseSearchResults(html: string, limit: number): Array<{ title: string; url: string; snippet?: string }> {
  const results: Array<{ title: string; url: string; snippet?: string }> = [];
  const resultPattern =
    /<a[^>]+(?:class="[^"]*(?:result__a|result-link)[^"]*"|class='[^']*(?:result__a|result-link)[^']*')[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(resultPattern)) {
    if (results.length >= limit) {
      break;
    }

    const title = stripHtmlTags(match[2] ?? "");
    const url = normalizeSearchHref(match[1] ?? "");
    if (title.length === 0 || url.length === 0) {
      continue;
    }

    results.push({ title, url });
  }

  return results;
}

async function executeWebSearch(args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.query !== "string" || input.query.trim().length === 0) {
    throw new ToolError("web_search requires a non-empty query.");
  }

  const limit =
    typeof input.limit === "number" && Number.isInteger(input.limit)
      ? Math.max(1, Math.min(10, input.limit))
      : 5;
  const baseUrl = process.env.CATNIP_WEB_SEARCH_BASE_URL ?? "https://html.duckduckgo.com/html/";
  const url = new URL(baseUrl);
  url.searchParams.set("q", input.query);

  const response = await fetch(url, {
    headers: {
      "user-agent": "catnip-agent/0.1",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) {
    throw new ToolError(`web_search failed with status ${response.status}.`);
  }

  const html = await response.text();
  const results = parseSearchResults(html, limit);

  return {
    query: input.query,
    engine: "duckduckgo-html",
    results,
  };
}

function resolveBrowserSearchUrl(query: string): string {
  const base = process.env.CATNIP_BROWSER_SEARCH_URL_BASE ?? "https://duckduckgo.com/";
  const url = new URL(base);
  url.searchParams.set("q", query);
  return url.toString();
}

async function executeOpenBrowserSearch(workspaceRoot: string, args: unknown): Promise<unknown> {
  const input = asObject(args);
  if (typeof input.query !== "string" || input.query.trim().length === 0) {
    throw new ToolError("open_browser_search requires a non-empty query.");
  }

  const targetUrl = resolveBrowserSearchUrl(input.query);
  const openCommand = resolveBrowserOpenCommand(targetUrl);
  await execFileAsync(openCommand.command, openCommand.argv, {
    cwd: workspaceRoot,
    maxBuffer: 1024 * 1024,
  });

  return {
    query: input.query,
    url: targetUrl,
    command: openCommand.command,
    argv: openCommand.argv,
  };
}

export async function executeToolCall({ workspaceRoot, tool, args }: ExecuteToolCallArgs): Promise<unknown> {
  switch (tool.name) {
    case "list_files":
      return executeListFiles(workspaceRoot, args);
    case "read_file":
      return executeReadFile(workspaceRoot, args);
    case "write_file":
      return executeWriteFile(workspaceRoot, args);
    case "patch_file":
      return executePatchFile(workspaceRoot, args);
    case "shell_exec":
      return executeShellExec(workspaceRoot, args);
    case "git_diff":
      return executeGitDiff(workspaceRoot);
    case "open_browser":
      return executeOpenBrowser(workspaceRoot, args);
    case "open_url":
      return executeOpenUrl(workspaceRoot, args);
    case "web_search":
      return executeWebSearch(args);
    case "open_browser_search":
      return executeOpenBrowserSearch(workspaceRoot, args);
    default:
      throw new ToolError(`Tool is not active yet: ${tool.name}`);
  }
}
