export interface JsonlLogger {
  write(entry: Record<string, unknown>): void;
}

export function createJsonlLogger(): JsonlLogger {
  return {
    write(entry) {
      void entry;
    },
  };
}
