import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "bundled-skills");

const ORDER = ["coingecko", "docker-hub", "pypi", "recipe-goat"] as const;
const FILE_BY_FAMILY: Record<(typeof ORDER)[number], string> = {
  coingecko: "coingecko.md",
  "docker-hub": "docker-hub.md",
  pypi: "pypi.md",
  "recipe-goat": "recipe-goat.md",
};

const MAX_TOTAL = 100_000;

/**
 * Full bundled SKILL.md bodies (from printing-press-library `cli-skills/pp-*`) for system prompt.
 */
export function buildPrintingPressCliSkillsPromptSection(): string {
  const chunks: string[] = [];
  for (const family of ORDER) {
    const fp = path.join(SKILLS_DIR, FILE_BY_FAMILY[family]);
    let body: string;
    try {
      body = fs.readFileSync(fp, "utf8");
    } catch {
      continue;
    }
    if (!body.trim()) continue;
    chunks.push(`### ${family}\n\n${body.trim()}`);
  }
  if (chunks.length === 0) return "";
  let out = chunks.join("\n\n---\n\n");
  if (out.length > MAX_TOTAL) {
    out = `${out.slice(0, MAX_TOTAL)}\n\n…(Printing Press skills truncated for prompt size)`;
  }
  return `## Printing Press library CLIs — bundled operator skills (SKILL.md)\n\nThese mirrors match the focused \`/pp-*\` skills from [printing-press-library](https://github.com/mvanhorn/printing-press-library). Use them to choose commands, flags (\`--agent\`, \`--json\`), env vars, and recovery. When the user asks for CoinGecko, Docker Hub, PyPI, Recipe Goat, etc., prefer invoking **\`cli.tool.run\`** (below) so results appear in the workspace execution summary.\n\n${out}`;
}
