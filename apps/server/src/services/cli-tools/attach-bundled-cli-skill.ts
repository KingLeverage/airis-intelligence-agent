import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "bundled-skills");

const FAMILY_FILES: Record<string, string> = {
  coingecko: "coingecko.md",
  "docker-hub": "docker-hub.md",
  pypi: "pypi.md",
  "recipe-goat": "recipe-goat.md",
};

const MAX_COMBINED = 120_000;

function readFileSafe(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function loadFamilySkill(familyId: string): string | null {
  const base = FAMILY_FILES[familyId];
  if (!base) return null;
  return readFileSafe(path.join(SKILLS_DIR, base));
}

/** Merge upstream-style SKILL.md bodies into cli-catalog widget data when missing. */
export function mergeBundledSkillIntoCliCatalogData(data: Record<string, unknown>): Record<string, unknown> {
  const existing = data.bundledSkillMarkdown;
  if (typeof existing === "string" && existing.trim().length > 0) {
    return data;
  }

  const familyRaw = data.cliFamilyId;
  const familyId = typeof familyRaw === "string" ? familyRaw.trim() : "";

  let markdown: string | null = null;
  if (familyId && FAMILY_FILES[familyId]) {
    markdown = loadFamilySkill(familyId);
  } else {
    const parts: string[] = [];
    for (const id of Object.keys(FAMILY_FILES)) {
      const body = loadFamilySkill(id);
      if (body?.trim()) {
        parts.push(`# Printing Press skill: ${id}\n\n${body.trim()}`);
      }
    }
    markdown = parts.length ? parts.join("\n\n---\n\n") : null;
  }

  if (!markdown?.trim()) {
    return data;
  }

  const clipped = markdown.length > MAX_COMBINED ? `${markdown.slice(0, MAX_COMBINED)}\n\n…(clipped)` : markdown;

  return {
    ...data,
    bundledSkillMarkdown: clipped,
  };
}
