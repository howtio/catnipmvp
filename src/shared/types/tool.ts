import type { PermissionLevel } from "./permission.js";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: PermissionLevel;
  category: "filesystem" | "shell" | "git";
  argShape: "object";
  stage: "skeleton" | "planned" | "active";
}

export interface ToolArgSchemaField {
  name: string;
  type: "string" | "boolean" | "number";
  required: boolean;
  description: string;
}
