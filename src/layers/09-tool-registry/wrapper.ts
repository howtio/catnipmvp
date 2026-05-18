import type { ToolDefinition } from "../../shared/types/tool.js";
import type { ToolRegistryLayerApi } from "./types.js";

const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: "list_files",
    description: "List files inside workspace.",
    permission: "low",
    category: "filesystem",
    argShape: "object",
    stage: "active",
  },
  {
    name: "read_file",
    description: "Read a single file inside workspace.",
    permission: "low",
    category: "filesystem",
    argShape: "object",
    stage: "active",
  },
  {
    name: "write_file",
    description: "Write a single file inside workspace.",
    permission: "medium",
    category: "filesystem",
    argShape: "object",
    stage: "planned",
  },
  {
    name: "patch_file",
    description: "Patch a file inside workspace.",
    permission: "medium",
    category: "filesystem",
    argShape: "object",
    stage: "planned",
  },
  {
    name: "shell_exec",
    description: "Run a guarded shell command inside workspace.",
    permission: "medium",
    category: "shell",
    argShape: "object",
    stage: "planned",
  },
  {
    name: "git_diff",
    description: "Inspect git diff inside workspace.",
    permission: "medium",
    category: "git",
    argShape: "object",
    stage: "active",
  },
];

export function createToolRegistryLayer(): ToolRegistryLayerApi {
  return {
    listTools(): ToolDefinition[] {
      return DEFAULT_TOOLS;
    },
    getTool(name: string): ToolDefinition | undefined {
      return DEFAULT_TOOLS.find((tool) => tool.name === name);
    },
  };
}
