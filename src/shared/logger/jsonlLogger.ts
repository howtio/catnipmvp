import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface JsonlLogger {
  write(entry: Record<string, unknown>): void;
}

export interface JsonlLoggerOptions {
  filePath?: string;
}

export function createJsonlLogger(options: JsonlLoggerOptions = {}): JsonlLogger {
  const filePath = options.filePath ?? join(process.cwd(), "logs", "catnip.jsonl");

  return {
    write(entry) {
      mkdirSync(dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
    },
  };
}
