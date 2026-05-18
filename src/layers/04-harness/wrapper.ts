import type { HarnessLayerApi, HarnessLayerDeps } from "./types.js";
import type { RunTask } from "../../shared/types/runTask.js";
import { createId } from "../../shared/utils/createId.js";

export function createHarnessLayer(deps: HarnessLayerDeps): HarnessLayerApi {
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
          type: "run.heartbeat",
          runId,
          at: new Date().toISOString(),
          stage: "runner.run.started",
        });

        await deps.runner.run(enrichedContext);
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
        };

        deps.eventbus.publish({
          type: "run.finished",
          runId,
          success,
        });

        console.log(
          `[harness] run ${runId} finished with skills=${report.selectedSkills.join(",") || "none"}`,
        );

        return report;
      } catch (error: unknown) {
        deps.eventbus.publish({
          type: "run.finished",
          runId,
          success,
        });
        throw error;
      }
    },
  };
}
