import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:process";
import type { ContextLayerApi } from "./types.js";
import type { RunTask } from "../../shared/types/runTask.js";
import type { ContextDocumentSummary, RunContext, WorkspaceSummary } from "./types.js";

const PLATFORM_HINT = platform === "win32"
  ? "Running on Windows. Use backslash paths. Write preview HTML to workspaces/demo/. Use 'dir' not 'ls'."
  : "Running on Unix-like system.";

const CORE_DOCUMENT_PATHS = process.env.CATNIP_DEV_CONTEXT === "1"
  ? [
      "CODEX_MASTER_REQUIREMENTS.md",
      "docs/DEV_PROGRESS.md",
      "docs/LOG.md",
    ]
  : [];

async function summarizeDocument(workspaceRoot: string, relativePath: string): Promise<ContextDocumentSummary> {
  const absolutePath = join(workspaceRoot, relativePath);
  const content = await readFile(absolutePath, "utf8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    path: relativePath,
    summary: lines.join(" ").slice(0, 320),
  };
}

async function buildWorkspaceSummary(workspaceRoot: string): Promise<WorkspaceSummary> {
  const topLevelEntries = (await readdir(workspaceRoot, { withFileTypes: true }))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const layerRoot = join(workspaceRoot, "src", "layers");
  const layerDirectories = (await readdir(layerRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return {
    root: workspaceRoot,
    topLevelEntries,
    layerDirectories,
  };
}

export function createContextLayer(): ContextLayerApi {
  return {
    async buildContext(runId: string, task: RunTask): Promise<RunContext> {
      const workspaceRoot = process.env.CATNIP_WORKSPACE_ROOT || process.cwd();
      const [coreDocuments, workspace] = await Promise.all([
        Promise.all(CORE_DOCUMENT_PATHS.map((path) => summarizeDocument(workspaceRoot, path))),
        buildWorkspaceSummary(workspaceRoot),
      ]);

      return {
        runId,
        task,
        docs: {
          coreDocuments,
        },
        workspace,
        sessionHistory: [],
        systemPrompt: [
          "You are Catnip Agent running inside a controlled local CLI MVP.",
          "Respect the ten-layer architecture and keep side effects out of Runner.",
          PLATFORM_HINT,
          `Current task: ${task.input}`,
        ].join("\n"),
      };
    },
  };
}
