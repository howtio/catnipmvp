import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
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
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.content, "utf8");

  return {
    path: input.path,
    bytesWritten: Buffer.byteLength(input.content, "utf8"),
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
    default:
      throw new ToolError(`Tool is not active yet: ${tool.name}`);
  }
}
