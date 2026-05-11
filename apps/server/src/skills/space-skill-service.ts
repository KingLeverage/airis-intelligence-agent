import type { SpaceSkillConfig } from "@airis/shared";
import { SpaceSkillConfigSchema } from "@airis/shared";
import { atomicWriteJson } from "../persistence/fs-utils.js";
import { readJsonWithSchema } from "../persistence/fs-utils.js";
import { spaceFile } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";
import { listSkillManifests, listDefaultEnabledSkillIds } from "./skill-discovery.js";

async function validSkillIdSet(): Promise<Set<string>> {
  const manifests = await listSkillManifests();
  return new Set(manifests.map((m) => m.id));
}

function defaultConfig(spaceId: string, enabledSkillIds: string[]): SpaceSkillConfig {
  return {
    spaceId,
    enabledSkillIds,
    pinnedSkillIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeConfig(
  spaceId: string,
  raw: SpaceSkillConfig,
  valid: Set<string>,
): SpaceSkillConfig {
  return {
    spaceId,
    enabledSkillIds: raw.enabledSkillIds.filter((id) => valid.has(id)),
    pinnedSkillIds: (raw.pinnedSkillIds ?? []).filter((id) => valid.has(id)),
    updatedAt: raw.updatedAt,
  };
}

/**
 * Load space skills.json or return defaults from `enabledByDefault` manifests (no file write).
 */
export async function getSpaceSkillConfig(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSkillConfig> {
  const valid = await validSkillIdSet();
  const file = spaceFile(spaceId, "skills.json", userId);
  const r = await readJsonWithSchema(file, SpaceSkillConfigSchema);
  if (!r.ok) {
    const enabled = (await listDefaultEnabledSkillIds()).filter((id) => valid.has(id));
    return defaultConfig(spaceId, enabled);
  }
  if (r.data.spaceId !== spaceId) {
    console.warn(`[skills] skills.json spaceId mismatch (file ${r.data.spaceId}, route ${spaceId})`);
  }
  return sanitizeConfig(spaceId, r.data, valid);
}

export async function updateSpaceSkillConfig(
  spaceId: string,
  patch: { enabledSkillIds?: string[]; pinnedSkillIds?: string[] },
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSkillConfig> {
  const current = await getSpaceSkillConfig(spaceId, userId);
  const valid = await validSkillIdSet();
  const next: SpaceSkillConfig = {
    spaceId,
    enabledSkillIds: patch.enabledSkillIds ?? current.enabledSkillIds,
    pinnedSkillIds: patch.pinnedSkillIds ?? current.pinnedSkillIds ?? [],
    updatedAt: new Date().toISOString(),
  };
  const sanitized = sanitizeConfig(spaceId, next, valid);
  await atomicWriteJson(spaceFile(spaceId, "skills.json", userId), sanitized);
  return sanitized;
}

export async function enableSkill(
  spaceId: string,
  skillId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSkillConfig> {
  const valid = await validSkillIdSet();
  if (!valid.has(skillId)) {
    return getSpaceSkillConfig(spaceId, userId);
  }
  const current = await getSpaceSkillConfig(spaceId, userId);
  const enabledSkillIds = current.enabledSkillIds.includes(skillId)
    ? current.enabledSkillIds
    : [...current.enabledSkillIds, skillId];
  return updateSpaceSkillConfig(
    spaceId,
    { enabledSkillIds, pinnedSkillIds: current.pinnedSkillIds },
    userId,
  );
}

export async function disableSkill(
  spaceId: string,
  skillId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSkillConfig> {
  const current = await getSpaceSkillConfig(spaceId, userId);
  return updateSpaceSkillConfig(
    spaceId,
    {
      enabledSkillIds: current.enabledSkillIds.filter((id) => id !== skillId),
      pinnedSkillIds: (current.pinnedSkillIds ?? []).filter((id) => id !== skillId),
    },
    userId,
  );
}
