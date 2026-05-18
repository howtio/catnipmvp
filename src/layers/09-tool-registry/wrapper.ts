import type { ToolDefinition } from "../../shared/types/tool.js";
import type { ToolRegistryLayerApi } from "./types.js";

const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: "list_files",
    description: "List files inside workspace.",
    permission: "low",
  },
  {
    name: "read_file",
    description: "Read a single file inside workspace.",
    permission: "low",
  },
];

export function createToolRegistryLayer(): ToolRegistryLayerApi {
  return {
    listTools(): ToolDefinition[] {
      return DEFAULT_TOOLS;
    },
  };
}
