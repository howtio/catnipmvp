export interface ConsoleLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createConsoleLogger(): ConsoleLogger {
  return {
    info(message, context) {
      console.log(message, context ?? {});
    },
    error(message, context) {
      console.error(message, context ?? {});
    },
  };
}
