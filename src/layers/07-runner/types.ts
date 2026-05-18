export interface RunnerLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
  };
}

export interface RunnerLayerApi {
  run(context: Record<string, unknown>): Promise<void>;
}
