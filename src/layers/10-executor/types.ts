import type { PermissionLevel } from "../../shared/types/permission.js";
import type { ToolDefinition } from "../../shared/types/tool.js";

export interface ToolCallRequest {
  [key: string]: unknown;
  type: "tool.call.requested";
  runId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  workspaceRoot: string;
  permission: PermissionLevel;
}

export type GuardResult =
  | {
      ok: true;
      tool: ToolDefinition;
      normalizedArgs: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export interface ExecutorLayerDeps {
  workspaceRoot: string;
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    subscribe(eventType: string, listener: (event: { type: string; [key: string]: unknown }) => void): () => void;
  };
  toolRegistry: {
    listTools(): ToolDefinition[];
    getTool(name: string): ToolDefinition | undefined;
  };
}

export interface ExecutorLayerApi {
  start(): void;
}
