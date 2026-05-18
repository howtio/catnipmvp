import type { CatnipEvent } from "../types/event.js";
import type { JsonlLogger } from "./jsonlLogger.js";

export function logEvent(logger: JsonlLogger, event: CatnipEvent): void {
  logger.write({
    ts: new Date().toISOString(),
    event: event.type,
    payload: event,
  });
}
