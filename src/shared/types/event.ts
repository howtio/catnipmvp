import type { PermissionLevel } from "./permission.js";

export type CatnipEvent =
  | {
      type: "run.started";
      runId: string;
      taskId: string;
      sessionId: string;
    }
  | {
      type: "run.finished";
      runId: string;
      success: boolean;
    }
  | {
      type: "agent.step.finished";
      runId: string;
      stepNumber: number;
      usage?: unknown;
    }
  | {
      type: "tool.call.requested";
      runId: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      workspaceRoot: string;
      permission: PermissionLevel;
    }
  | {
      type: "tool.call.result";
      runId: string;
      toolCallId: string;
      ok: true;
      result: unknown;
    }
  | {
      type: "tool.call.failed";
      runId: string;
      toolCallId: string;
      ok: false;
      error: string;
    }
  | {
      type: "worker.heartbeat";
      workerId: string;
      at: string;
      busy: boolean;
    }
  | {
      type: "run.heartbeat";
      runId: string;
      at: string;
      stage: string;
    };
