import type { PermissionLevel } from "./permission.js";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: PermissionLevel;
}
