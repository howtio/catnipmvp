import type { RunTask } from "../../shared/types/runTask.js";

export interface HarnessLayerDeps {
  context: {
    buildContext(task: RunTask): Promise<Record<string, unknown>>;
  };
  skills: {
    injectSkills(context: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  runner: {
    run(context: Record<string, unknown>): Promise<void>;
  };
}

export interface HarnessLayerApi {
  runTask(task: RunTask): Promise<void>;
}
