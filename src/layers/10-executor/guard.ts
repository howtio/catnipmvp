import { PolicyError } from "../../shared/errors/PolicyError.js";
import { resolve } from "node:path";
import type { PermissionLevel } from "../../shared/types/permission.js";
import type { ToolDefinition } from "../../shared/types/tool.js";
import type { GuardResult, ToolCallRequest } from "./types.js";

const ALLOWED_SHELL_COMMANDS = [
  ["npm", "test"],
  ["npm", "run", "test"],
  ["npm", "run", "build"],
  ["pnpm", "test"],
  ["pnpm", "build"],
  ["git", "status"],
  ["git", "diff"],
  ["ls"],
  ["cat"],
] as const;

interface GuardToolCallDeps {
  workspaceRoot: string;
  toolRegistry: {
    getTool(name: string): ToolDefinition | undefined;
  };
}

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === "low" || value === "medium" || value === "high";
}

function ensureWorkspaceRoot(workspaceRoot: string, requestRoot: unknown): void {
  if (typeof requestRoot !== "string" || requestRoot.length === 0) {
    throw new PolicyError("Tool call is missing workspaceRoot.");
  }

  if (requestRoot !== workspaceRoot) {
    throw new PolicyError("Tool call workspaceRoot is outside the active workspace.");
  }
}

function ensureArgsShape(args: unknown): void {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new PolicyError("Tool call args must be a plain object.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ensurePathInsideWorkspace(workspaceRoot: string, candidatePath: unknown): void {
  if (typeof candidatePath !== "string" || candidatePath.length === 0) {
    throw new PolicyError("Tool call path must be a non-empty string.");
  }

  const resolvedPath = resolve(workspaceRoot, candidatePath);
  const normalizedRoot = resolve(workspaceRoot);
  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}/`)) {
    throw new PolicyError("Tool call path is outside the active workspace.");
  }
}

function ensureFilesystemArgs(toolName: string, args: unknown, workspaceRoot: string): void {
  if (!isRecord(args)) {
    throw new PolicyError("Filesystem tool args must be a plain object.");
  }

  if (toolName === "read_file" || toolName === "write_file" || toolName === "patch_file") {
    ensurePathInsideWorkspace(workspaceRoot, args.path);
  }

  if (toolName === "list_files" && args.path !== undefined) {
    ensurePathInsideWorkspace(workspaceRoot, args.path);
  }
}

function ensureStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new PolicyError(`${fieldName} must be an array of strings.`);
  }

  return value;
}

function ensureShellArgs(args: unknown): void {
  if (!isRecord(args)) {
    throw new PolicyError("shell_exec args must be a plain object.");
  }

  if (typeof args.command !== "string" || args.command.length === 0) {
    throw new PolicyError("shell_exec requires a command string.");
  }

  const argv = ensureStringArray(args.argv, "shell_exec argv");
  const requested = [args.command, ...argv];
  const allowed = ALLOWED_SHELL_COMMANDS.some(
    (candidate) =>
      candidate.length === requested.length &&
      candidate.every((segment, index) => requested[index] === segment),
  );

  if (!allowed) {
    throw new PolicyError(`shell_exec command is not allowed: ${requested.join(" ")}`);
  }
}

function ensureToolSpecificArgs(tool: ToolDefinition, args: unknown, workspaceRoot: string): void {
  if (tool.category === "filesystem") {
    ensureFilesystemArgs(tool.name, args, workspaceRoot);
    return;
  }

  if (tool.name === "shell_exec") {
    ensureShellArgs(args);
  }
}

function ensurePermissionMatches(expected: PermissionLevel, actual: unknown): void {
  if (!isPermissionLevel(actual)) {
    throw new PolicyError("Tool call permission is invalid.");
  }

  if (actual !== expected) {
    throw new PolicyError(`Tool call permission mismatch: expected ${expected}, received ${actual}.`);
  }
}

export function guardToolCall(
  request: ToolCallRequest,
  deps: GuardToolCallDeps,
): GuardResult {
  try {
    const tool = deps.toolRegistry.getTool(request.toolName);
    if (!tool) {
      throw new PolicyError(`Unknown tool: ${request.toolName}`);
    }

    ensurePermissionMatches(tool.permission, request.permission);
    ensureArgsShape(request.args);
    ensureWorkspaceRoot(deps.workspaceRoot, request.workspaceRoot);
    ensureToolSpecificArgs(tool, request.args, deps.workspaceRoot);

    return {
      ok: true,
      tool,
      normalizedArgs: request.args,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
    };
  }
}
