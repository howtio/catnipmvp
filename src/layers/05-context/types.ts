import type { RunTask } from "../../shared/types/runTask.js";

export interface ContextLayerApi {
  buildContext(task: RunTask): Promise<Record<string, unknown>>;
}
