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
      type: "agent.answer.produced";
      runId: string;
      answer: string;
    }
  | {
      type: "prompt.composed";
      runId: string;
      taskInput: string;
      systemPrompt: string;
      skillInstructions: string;
      selectedSkills: string[];
      loadedDocuments: string[];
      workspaceRoot: string;
    }
  | {
      type: "agent.plan.generated";
      runId: string;
      mode: string;
      plannedToolCalls: Array<{
        toolName: string;
        reason: string;
        args: unknown;
      }>;
      finalAnswerPrompt?: string;
    }
  | {
      type: "agent.reasoning.summary";
      runId: string;
      stepNumber: number;
      summary: string;
      toolCalls?: number;
      toolResults?: number;
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
