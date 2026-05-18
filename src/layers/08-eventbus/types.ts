import type { CatnipEvent } from "../../shared/types/event.js";

export interface EventBusLayerApi {
  start?(): void;
  publish(event: CatnipEvent | { type: string; [key: string]: unknown }): void;
}
