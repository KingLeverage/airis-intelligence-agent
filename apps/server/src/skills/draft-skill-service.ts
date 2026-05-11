import fs from "node:fs/promises";
import path from "node:path";
import type { SkillManifest } from "@airis/shared";
import { SkillManifestSchema } from "@airis/shared";
import { getSkillsDir } from "../config.js";
import { atomicWriteJson } from "../persistence/fs-utils.js";
import { readTextIfExists } from "../persistence/fs-utils.js";
import { loadSkillManifest } from "./skill-discovery.js";

const DRAFT_ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function draftsRoot(): string {
  return path.join(getSkillsDir(), "drafts");
}

export function isReservedTopLevelSkillDir(name: string): boolean {
  return name.startsWith(".") || name.startsWith("_") || name === "drafts" || name === "_future";
}

function draftDir(draftId: string): string {
  return path.join(draftsRoot(), draftId);
}

export function validateDraftId(draftId: string): { ok: true } | { ok: false; error: string } {
  if (!DRAFT_ID_RE.test(draftId)) {
    return { ok: false, error: "invalid_draft_id" };
  }
  if (draftId === "drafts" || draftId === "_future") {
    return { ok: false, error: "reserved_draft_id" };
  }
  return { ok: true };
}

export type DraftSkillListItem = {
  draftId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest: SkillManifest | null;
};

export async function listDraftSkills(): Promise<DraftSkillListItem[]> {
  const root = draftsRoot();
  let entries: string[] = [];
  try {
    const dirents = await fs.readdir(root, { withFileTypes: true });
    entries = dirents.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw e;
  }
  const out: DraftSkillListItem[] = [];
  for (const draftId of entries.sort()) {
    out.push(await inspectDraftFolder(draftId));
  }
  return out;
}

export async function inspectDraftFolder(draftId: string): Promise<DraftSkillListItem> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const idCheck = validateDraftId(draftId);
  if (!idCheck.ok) {
    errors.push(idCheck.error);
    return { draftId, valid: false, errors, warnings, manifest: null };
  }
  const dir = draftDir(draftId);
  const manifestPath = path.join(dir, "skill.json");
  const text = await readTextIfExists(manifestPath);
  if (!text) {
    errors.push("missing_skill_json");
    return { draftId, valid: false, errors, warnings, manifest: null };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    errors.push("invalid_skill_json");
    return { draftId, valid: false, errors, warnings, manifest: null };
  }
  const parsed = SkillManifestSchema.safeParse(raw);
  if (!parsed.success) {
    errors.push(parsed.error.message);
    return { draftId, valid: false, errors, warnings, manifest: null };
  }
  const manifest = parsed.data;
  if (manifest.id !== draftId) {
    errors.push("manifest.id_must_match_draft_folder_name");
    return { draftId, valid: false, errors, warnings, manifest: null };
  }
  const skillMd = manifest.entryInstructionFile || "SKILL.md";
  const instr = await readTextIfExists(path.join(dir, skillMd));
  if (instr == null) {
    warnings.push(`missing_instruction_file:${skillMd}`);
  }
  return { draftId, valid: true, errors, warnings, manifest };
}

export type CreateDraftInput = {
  draftId: string;
  manifest: unknown;
  skillMd?: string;
};

export async function createDraftSkill(input: CreateDraftInput): Promise<DraftSkillListItem> {
  const idCheck = validateDraftId(input.draftId);
  if (!idCheck.ok) {
    return {
      draftId: input.draftId,
      valid: false,
      errors: [idCheck.error],
      warnings: [],
      manifest: null,
    };
  }
  const parsed = SkillManifestSchema.safeParse(input.manifest);
  if (!parsed.success) {
    return {
      draftId: input.draftId,
      valid: false,
      errors: [parsed.error.message],
      warnings: [],
      manifest: null,
    };
  }
  const manifest = parsed.data;
  if (manifest.id !== input.draftId) {
    return {
      draftId: input.draftId,
      valid: false,
      errors: ["manifest.id_must_match_draft_folder_name"],
      warnings: [],
      manifest: null,
    };
  }
  if ((await loadSkillManifest(manifest.id)) != null) {
    return {
      draftId: input.draftId,
      valid: false,
      errors: ["production_skill_id_already_exists"],
      warnings: [],
      manifest: null,
    };
  }
  await fs.mkdir(draftsRoot(), { recursive: true });
  const dir = draftDir(input.draftId);
  try {
    await fs.mkdir(dir, { recursive: false });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "EEXIST") {
      return {
        draftId: input.draftId,
        valid: false,
        errors: ["draft_already_exists"],
        warnings: [],
        manifest: null,
      };
    }
    throw e;
  }
  await atomicWriteJson(path.join(dir, "skill.json"), manifest);
  const mdName = manifest.entryInstructionFile || "SKILL.md";
  if (input.skillMd != null && input.skillMd.length > 0) {
    await fs.writeFile(path.join(dir, mdName), input.skillMd, "utf8");
  }
  return inspectDraftFolder(input.draftId);
}

async function productionSkillPath(skillId: string): Promise<string | null> {
  const p = path.join(getSkillsDir(), skillId, "skill.json");
  try {
    await fs.access(p);
    return path.dirname(p);
  } catch {
    return null;
  }
}

export type PromoteResult =
  | { ok: true; skillId: string }
  | { ok: false; error: string };

/**
 * Copy draft folder to `skills/{manifest.id}/`, force `enabledByDefault: false`, remove draft folder.
 */
export async function promoteDraftSkill(draftId: string): Promise<PromoteResult> {
  const inspected = await inspectDraftFolder(draftId);
  if (!inspected.valid || !inspected.manifest) {
    return { ok: false, error: inspected.errors[0] ?? "invalid_draft" };
  }
  const manifest = inspected.manifest;
  const skillId = manifest.id;
  if (isReservedTopLevelSkillDir(skillId) || skillId === "drafts") {
    return { ok: false, error: "invalid_target_skill_id" };
  }
  const targetDir = path.join(getSkillsDir(), skillId);
  const existing = await productionSkillPath(skillId);
  if (existing) {
    return { ok: false, error: "production_skill_already_exists" };
  }
  const src = draftDir(draftId);
  await fs.cp(src, targetDir, { recursive: true });
  const promoted: SkillManifest = {
    ...manifest,
    enabledByDefault: false,
  };
  await atomicWriteJson(path.join(targetDir, "skill.json"), promoted);
  await fs.rm(src, { recursive: true, force: true });
  return { ok: true, skillId };
}

export async function deleteDraftSkill(draftId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const idCheck = validateDraftId(draftId);
  if (!idCheck.ok) return { ok: false, error: idCheck.error };
  const dir = draftDir(draftId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, error: "draft_not_found" };
    }
    throw e;
  }
  return { ok: true };
}
