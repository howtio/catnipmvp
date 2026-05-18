import type { EnrichedRunContext } from "../06-skills/index.js";

export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
  };
}

export interface RunnerLayerApi {
  run(context: EnrichedRunContext): Promise<void>;
}
