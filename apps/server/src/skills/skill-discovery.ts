import fs from "node:fs/promises";
import path from "node:path";
import type { SkillManifest, SkillSummary } from "@airis/shared";
import { SkillManifestSchema } from "@airis/shared";
import { getSkillsDir } from "../config.js";
import { readTextIfExists } from "../persistence/fs-utils.js";

function skillDir(skillId: string): string {
  return path.join(getSkillsDir(), skillId);
}

function manifestPath(skillId: string): string {
  return path.join(skillDir(skillId), "skill.json");
}

export function manifestToSummary(m: SkillManifest): SkillSummary {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    tags: m.tags,
    version: m.version,
    promptHint: m.promptHint,
  };
}

/**
 * Scan skills root; invalid folders are skipped (warn-only).
 */
export async function discoverSkillIds(): Promise<string[]> {
  const root = getSkillsDir();
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.warn(`[skills] cannot read skills dir ${root}:`, e);
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter(
      (name) =>
        !name.startsWith(".") && !name.startsWith("_") && name !== "drafts" && name !== "_future",
    );
}

export async function loadSkillManifest(skillId: string): Promise<SkillManifest | null> {
  const file = manifestPath(skillId);
  const text = await readTextIfExists(file);
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    console.warn(`[skills] invalid JSON in ${file}`);
    return null;
  }
  const parsed = SkillManifestSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[skills] invalid manifest ${file}: ${parsed.error.message}`);
    return null;
  }
  if (parsed.data.id !== skillId) {
    console.warn(`[skills] manifest id "${parsed.data.id}" != folder "${skillId}" (${file})`);
  }
  return parsed.data;
}

export async function listSkillManifests(): Promise<SkillManifest[]> {
  const ids = await discoverSkillIds();
  const out: SkillManifest[] = [];
  for (const id of ids) {
    const m = await loadSkillManifest(id);
    if (m) out.push(m);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export async function listSkillSummaries(): Promise<SkillSummary[]> {
  const manifests = await listSkillManifests();
  return manifests.map(manifestToSummary);
}

export async function listDefaultEnabledSkillIds(): Promise<string[]> {
  const manifests = await listSkillManifests();
  return manifests.filter((m) => m.enabledByDefault).map((m) => m.id);
}

export async function loadSkillInstructions(skillId: string): Promise<{
  body: string | null;
  warning?: string;
}> {
  const m = await loadSkillManifest(skillId);
  if (!m) {
    return { body: null, warning: "skill_not_found" };
  }
  const rel = m.entryInstructionFile || "SKILL.md";
  const file = path.join(skillDir(skillId), rel);
  const text = await readTextIfExists(file);
  if (text == null) {
    return { body: null, warning: `missing_instruction_file:${rel}` };
  }
  return { body: text };
}

const MAX_TEMPLATE_LIST = 24;

export async function listSkillTemplateBasenames(skillId: string): Promise<string[]> {
  const m = await loadSkillManifest(skillId);
  if (!m) return [];
  const sub = m.templatesPath ?? "templates";
  const dir = path.join(skillDir(skillId), sub);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  return files.filter((f) => !f.startsWith(".")).slice(0, MAX_TEMPLATE_LIST);
}

export async function readSkillTemplateFile(skillId: string, basename: string): Promise<string | null> {
  const m = await loadSkillManifest(skillId);
  if (!m) return null;
  if (basename.includes("..") || basename.includes("/") || basename.includes("\\")) return null;
  const sub = m.templatesPath ?? "templates";
  const base = path.resolve(path.join(skillDir(skillId), sub));
  const file = path.resolve(base, basename);
  if (!file.startsWith(base + path.sep) && file !== base) return null;
  return readTextIfExists(file);
}
