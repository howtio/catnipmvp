import { EventEmitter } from "node:events";
import type { EventBusLayerApi } from "./types.js";

export function createEventBusLayer(): EventBusLayerApi {
  const emitter = new EventEmitter();

  return {
    publish(event): void {
      emitter.emit(event.type, event);
    },
  };
}
