import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillsLayerApi } from "./types.js";
import type { EnrichedRunContext, LoadedSkill } from "./types.js";
import type { RunContext } from "../05-context/index.js";

function selectSkillNames(taskInput: string, availableSkillNames: string[]): string[] {
  const normalizedInput = taskInput.toLowerCase();
  const selected = new Set<string>();

  if (availableSkillNames.includes("coding")) {
    selected.add("coding");
  }

  if (
    /test|verify|validation|assert|spec|测试|验证/.test(normalizedInput) &&
    availableSkillNames.includes("testing")
  ) {
    selected.add("testing");
  }

  if (selected.size === 0 && availableSkillNames.length > 0) {
    selected.add(availableSkillNames[0] as string);
  }

  return [...selected];
}

async function loadSkill(skillName: string, taskInput: string, workspaceRoot: string): Promise<LoadedSkill> {
  const relativePath = join("skills", skillName, "SKILL.md");
  const content = await readFile(join(workspaceRoot, relativePath), "utf8");

  return {
    name: skillName,
    path: relativePath,
    reason: taskInput.toLowerCase().match(/test|verify|validation|测试|验证/) && skillName === "testing"
      ? "Task input mentions testing or verification."
      : "Default implementation skill for code changes.",
    content,
  };
}

export function createSkillsLayer(): SkillsLayerApi {
  return {
    async injectSkills(context: RunContext): Promise<EnrichedRunContext> {
      const workspaceRoot = process.cwd();
      const availableSkillNames = (await readdir(join(workspaceRoot, "skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
      const selectedSkillNames = selectSkillNames(context.task.input, availableSkillNames);
      const skills = await Promise.all(
        selectedSkillNames.map((skillName) => loadSkill(skillName, context.task.input, workspaceRoot)),
      );

      return {
        ...context,
        skills,
        skillNames: skills.map((skill) => skill.name),
        skillInstructions: skills.map((skill) => `# ${skill.name}\n${skill.content}`).join("\n\n"),
      };
    },
  };
}
