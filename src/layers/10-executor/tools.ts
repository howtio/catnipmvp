import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, relative } from "node:path";
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

export async function executeToolCall({ workspaceRoot, tool, args }: ExecuteToolCallArgs): Promise<unknown> {
  switch (tool.name) {
    case "list_files":
      return executeListFiles(workspaceRoot, args);
    case "read_file":
      return executeReadFile(workspaceRoot, args);
    case "git_diff":
      return executeGitDiff(workspaceRoot);
    default:
      throw new ToolError(`Tool is not active yet: ${tool.name}`);
  }
}
