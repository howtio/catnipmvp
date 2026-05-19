import type { HarnessLayerApi, HarnessLayerDeps } from "./types.js";
import type { RunTask } from "../../shared/types/runTask.js";
import { createId } from "../../shared/utils/createId.js";
import { TimeoutError } from "../../shared/errors/TimeoutError.js";

const DEFAULT_LIMITS = {
  runTimeoutMs: 180_000,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new TimeoutError(message));
    }, timeoutMs);
    timeout.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function createHarnessLayer(deps: HarnessLayerDeps): HarnessLayerApi {
  const limits = {
    ...DEFAULT_LIMITS,
    ...deps.limits,
  };

  return {
    async runTask(task: RunTask) {
      const runId = createId("run");
      const startedAt = new Date().toISOString();

      deps.eventbus.publish({
        type: "run.started",
        runId,
        taskId: task.id,
        sessionId: task.sessionId,
      });
      deps.eventbus.publish({
        type: "run.heartbeat",
        runId,
        at: startedAt,
        stage: "context.build.started",
      });

      let success = false;

      try {
        const context = await deps.context.buildContext(runId, task);
        deps.eventbus.publish({
          type: "run.heartbeat",
          runId,
          at: new Date().toISOString(),
          stage: "skills.inject.started",
        });

        const enrichedContext = await deps.skills.injectSkills(context);
        deps.eventbus.publish({
          type: "prompt.composed",
          runId,
          taskInput: task.input,
          systemPrompt: enrichedContext.systemPrompt,
          skillInstructions: enrichedContext.skillInstructions,
          selectedSkills: enrichedContext.skillNames,
          loadedDocuments: enrichedContext.docs.coreDocuments.map((document) => document.path),
          workspaceRoot: enrichedContext.workspace.root,
        });
        deps.eventbus.publish({
          type: "run.heartbeat",
          runId,
          at: new Date().toISOString(),
          stage: "runner.run.started",
        });

        const runResult = await withTimeout(
          deps.runner.run(enrichedContext),
          limits.runTimeoutMs,
          `Run exceeded timeout of ${limits.runTimeoutMs}ms.`,
        );
        success = true;

        const report = {
          runId,
          taskId: task.id,
          sessionId: task.sessionId,
          success,
          startedAt,
          finishedAt: new Date().toISOString(),
          selectedSkills: enrichedContext.skillNames,
          loadedDocuments: enrichedContext.docs.coreDocuments.map((document) => document.path),
          stepsUsed: runResult.stepsUsed,
          finalAnswer: runResult.finalAnswer,
          toolSummaryCount: runResult.toolSummaries.length,
        };
        deps.reportLogger.write({
          ts: report.finishedAt,
          event: "run.report",
          payload: report,
        });

        deps.eventbus.publish({
          type: "run.finished",
          runId,
          success,
          failureKind: "none",
        });

        console.log(
          `[harness] run ${runId} finished success=${report.success} skills=${report.selectedSkills.join(",") || "none"}`,
        );

        return report;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const failureKind = error instanceof TimeoutError ? "timeout" : "runtime";
        deps.reportLogger.write({
          ts: new Date().toISOString(),
          event: "run.report",
          payload: {
            runId,
            taskId: task.id,
            sessionId: task.sessionId,
            success,
            startedAt,
            finishedAt: new Date().toISOString(),
            stepsUsed: 0,
            finalAnswer: "",
            toolSummaryCount: 0,
            errorMessage,
            failureKind,
          },
        });
        deps.eventbus.publish({
          type: "run.finished",
          runId,
          success,
          failureKind,
          errorMessage,
        });
        throw error;
      }
    },
  };
}
