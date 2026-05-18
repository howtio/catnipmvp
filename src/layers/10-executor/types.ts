export interface ExecutorLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
  };
  toolRegistry: {
    listTools(): Array<{ name: string }>;
  };
}

export interface ExecutorLayerApi {
  start(): void;
}
