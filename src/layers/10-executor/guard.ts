import { PolicyError } from "../../shared/errors/PolicyError.js";
import { resolve } from "node:path";
import type { PermissionLevel } from "../../shared/types/permission.js";
import type { ToolDefinition } from "../../shared/types/tool.js";
import type { GuardResult, ToolCallRequest } from "./types.js";

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

  if (toolName === "read_file") {
    ensurePathInsideWorkspace(workspaceRoot, args.path);
  }

  if (toolName === "list_files" && args.path !== undefined) {
    ensurePathInsideWorkspace(workspaceRoot, args.path);
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
    ensureFilesystemArgs(tool.name, request.args, deps.workspaceRoot);

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
