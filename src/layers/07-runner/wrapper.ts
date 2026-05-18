import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";
import type { EnrichedRunContext } from "../06-skills/index.js";

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: EnrichedRunContext): Promise<void> {
      const runId = context.runId;
      deps.eventbus.publish({
        type: "agent.step.finished",
        runId,
        stepNumber: 1,
        usage: {
          mode: "skeleton",
          contextKeys: Object.keys(context),
        },
      });
    },
  };
}
