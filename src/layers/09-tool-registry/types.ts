import type { ToolDefinition } from "../../shared/types/tool.js";

export interface ToolRegistryLayerApi {
  listTools(): ToolDefinition[];
  getTool(name: string): ToolDefinition | undefined;
}
