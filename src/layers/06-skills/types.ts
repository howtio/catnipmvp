export interface SkillsLayerApi {
  injectSkills(context: Record<string, unknown>): Promise<Record<string, unknown>>;
}
