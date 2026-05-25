import { PolicyError } from "../../shared/errors/PolicyError.js";
import { extname, resolve } from "node:path";
import { platform } from "node:process";
import type { PermissionLevel } from "../../shared/types/permission.js";
import type { ToolDefinition } from "../../shared/types/tool.js";
import type { GuardResult, ToolCallRequest } from "./types.js";

const ALLOWED_SHELL_COMMAND_NAMES = new Set([
  "npm", "pnpm", "git", "node", "npx",
  "ls", "cat", "pwd",
  "dir", "type", "echo", "cd", "where", "cmd",
]);

const DANGEROUS_COMMAND_PREFIXES = [
  "rm", "del", "format", "reg", "shutdown", "taskkill",
  "chmod", "chown", "sudo", "deltree", "rd", "rmdir",
];

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

function normalizePathSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

function ensurePathInsideWorkspace(workspaceRoot: string, candidatePath: unknown): void {
  if (typeof candidatePath !== "string" || candidatePath.length === 0) {
    throw new PolicyError("Tool call path must be a non-empty string.");
  }

  const resolvedPath = normalizePathSeparators(resolve(workspaceRoot, candidatePath));
  const normalizedRoot = normalizePathSeparators(resolve(workspaceRoot));
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

  const commandName = args.command.toLowerCase();
  if (!ALLOWED_SHELL_COMMAND_NAMES.has(commandName)) {
    throw new PolicyError(
      `shell_exec command is not allowed: ${args.command}. Allowed: ${[...ALLOWED_SHELL_COMMAND_NAMES].sort().join(", ")}`,
    );
  }

  const argv = ensureStringArray(args.argv, "shell_exec argv");
  const fullCommand = [args.command, ...argv].join(" ");
  for (const dangerous of DANGEROUS_COMMAND_PREFIXES) {
    if (fullCommand.toLowerCase().startsWith(dangerous)) {
      throw new PolicyError(`shell_exec command is denied: ${fullCommand}`);
    }
  }
}

function ensureBrowserArgs(args: unknown, workspaceRoot: string): void {
  if (!isRecord(args)) {
    throw new PolicyError("open_browser args must be a plain object.");
  }

  ensurePathInsideWorkspace(workspaceRoot, args.path);
  if (typeof args.path !== "string") {
    throw new PolicyError("open_browser path must be a string.");
  }

  const extension = extname(args.path).toLowerCase();
  if (extension !== ".html" && extension !== ".htm") {
    throw new PolicyError("open_browser only allows .html or .htm files.");
  }

  const normalizedPath = normalizePathSeparators(args.path);
  if (!normalizedPath.startsWith("workspaces/demo/")) {
    throw new PolicyError("open_browser only allows files inside workspaces/demo/.");
  }
}

function ensureSearchQueryArgs(toolName: "web_search" | "open_browser_search", args: unknown): void {
  if (!isRecord(args)) {
    throw new PolicyError(`${toolName} args must be a plain object.`);
  }

  if (typeof args.query !== "string" || args.query.trim().length === 0) {
    throw new PolicyError(`${toolName} requires a non-empty query string.`);
  }

  if (args.query.length > 500) {
    throw new PolicyError(`${toolName} query is too long.`);
  }

  if (toolName === "web_search" && args.limit !== undefined) {
    if (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 10) {
      throw new PolicyError("web_search limit must be an integer between 1 and 10.");
    }
  }
}

function ensureOpenUrlArgs(args: unknown): void {
  if (!isRecord(args)) {
    throw new PolicyError("open_url args must be a plain object.");
  }

  if (typeof args.url !== "string" || args.url.trim().length === 0) {
    throw new PolicyError("open_url requires a non-empty url string.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(args.url);
  } catch {
    throw new PolicyError("open_url requires a valid absolute URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new PolicyError("open_url only allows http or https URLs.");
  }
}

function ensureToolSpecificArgs(tool: ToolDefinition, args: unknown, workspaceRoot: string): void {
  if (tool.category === "filesystem") {
    ensureFilesystemArgs(tool.name, args, workspaceRoot);
    return;
  }

  if (tool.name === "shell_exec") {
    ensureShellArgs(args);
    return;
  }

  if (tool.name === "open_browser") {
    ensureBrowserArgs(args, workspaceRoot);
    return;
  }

  if (tool.name === "web_search" || tool.name === "open_browser_search") {
    ensureSearchQueryArgs(tool.name, args);
    return;
  }

  if (tool.name === "open_url") {
    ensureOpenUrlArgs(args);
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
