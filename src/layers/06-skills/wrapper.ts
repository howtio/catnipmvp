import type { SkillsLayerApi } from "./types.js";

export function createSkillsLayer(): SkillsLayerApi {
  return {
    async injectSkills(context: Record<string, unknown>): Promise<Record<string, unknown>> {
      return {
        ...context,
        skills: ["coding", "testing"],
      };
    },
  };
}
