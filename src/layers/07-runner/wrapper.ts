import type { RunnerLayerApi, RunnerLayerDeps } from "./types.js";

export function createRunnerLayer(deps: RunnerLayerDeps): RunnerLayerApi {
  return {
    async run(context: Record<string, unknown>): Promise<void> {
      deps.eventbus.publish({
        type: "agent.step.finished",
        runId: "run_skeleton",
        stepNumber: 1,
        usage: {
          mode: "skeleton",
          contextKeys: Object.keys(context),
        },
      });
    },
  };
}
