import type { RunContext } from "../05-context/index.js";

export interface LoadedSkill {
  name: string;
  path: string;
  reason: string;
  content: string;
}

export interface EnrichedRunContext extends RunContext {
  skills: LoadedSkill[];
  skillNames: string[];
  skillInstructions: string;
}

export interface SkillsLayerApi {
  injectSkills(context: RunContext): Promise<EnrichedRunContext>;
}
