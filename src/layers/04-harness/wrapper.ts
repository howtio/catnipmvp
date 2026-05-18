import type { HarnessLayerApi, HarnessLayerDeps } from "./types.js";
import type { RunTask } from "../../shared/types/runTask.js";

export function createHarnessLayer(deps: HarnessLayerDeps): HarnessLayerApi {
  return {
    async runTask(task: RunTask): Promise<void> {
      const context = await deps.context.buildContext(task);
      const enrichedContext = await deps.skills.injectSkills(context);
      await deps.runner.run(enrichedContext);
    },
  };
}
