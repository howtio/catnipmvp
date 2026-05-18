import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function parseEnvFile(content: string): Array<[string, string]> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      if (index === -1) {
        return undefined;
      }

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key.length === 0) {
        return undefined;
      }

      return [key, value] as const;
    })
    .filter((entry): entry is [string, string] => entry !== undefined);
}

export function loadLocalEnvFiles(rootDir: string = process.cwd()): void {
  const secretsDir = join(rootDir, ".local-secrets");
  if (!existsSync(secretsDir)) {
    return;
  }

  const envFiles = readdirSync(secretsDir)
    .filter((fileName) => fileName.endsWith(".env"))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of envFiles) {
    const fullPath = join(secretsDir, fileName);
    const content = readFileSync(fullPath, "utf8");
    for (const [key, value] of parseEnvFile(content)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}
