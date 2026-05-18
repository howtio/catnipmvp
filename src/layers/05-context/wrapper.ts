import type { ContextLayerApi } from "./types.js";
import type { RunTask } from "../../shared/types/runTask.js";

export function createContextLayer(): ContextLayerApi {
  return {
    async buildContext(task: RunTask): Promise<Record<string, unknown>> {
      return {
        task,
        docsEntry: "CODEX_MASTER_REQUIREMENTS.md",
        skills: [],
      };
    },
  };
}
