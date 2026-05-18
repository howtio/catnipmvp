export interface ExecutorLayerDeps {
  eventbus: {
    publish(event: { type: string; [key: string]: unknown }): void;
    subscribe(eventType: string, listener: (event: { type: string; [key: string]: unknown }) => void): () => void;
  };
  toolRegistry: {
    listTools(): Array<{ name: string }>;
    getTool(name: string): { name: string; description: string; permission: string } | undefined;
  };
}

export interface ExecutorLayerApi {
  start(): void;
}
