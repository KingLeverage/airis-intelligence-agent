import type { SkillPromptMetrics, SpaceSkillAnalytics } from "@airis/shared";
import { SpaceSkillAnalyticsSchema } from "@airis/shared";
import { atomicWriteJson } from "../persistence/fs-utils.js";
import { readJsonWithSchema } from "../persistence/fs-utils.js";
import { spaceFile } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";

function emptyAnalytics(spaceId: string): SpaceSkillAnalytics {
  return {
    schemaVersion: 1,
    spaceId,
    updatedAt: new Date().toISOString(),
    turnsRecorded: 0,
    totalEstimatedSkillPromptChars: 0,
    bySkillId: {},
  };
}

export async function getSpaceSkillAnalytics(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSkillAnalytics> {
  const file = spaceFile(spaceId, "skill-analytics.json", userId);
  const r = await readJsonWithSchema(file, SpaceSkillAnalyticsSchema);
  if (!r.ok) return emptyAnalytics(spaceId);
  if (r.data.spaceId !== spaceId) return { ...r.data, spaceId };
  return r.data;
}

export async function recordSkillAnalytics(
  spaceId: string,
  metrics: SkillPromptMetrics,
  userId: string = DEFAULT_USER_ID,
): Promise<void> {
  const cur = await getSpaceSkillAnalytics(spaceId, userId);
  const bySkillId: SpaceSkillAnalytics["bySkillId"] = { ...cur.bySkillId };
  const now = new Date().toISOString();
  for (const id of metrics.activeSkillIds) {
    const prev = bySkillId[id] ?? {
      routedCount: 0,
      instructionCharsInjected: 0,
    };
    const added = metrics.perSkillInstructionChars?.[id] ?? 0;
    bySkillId[id] = {
      routedCount: prev.routedCount + 1,
      lastRoutedAt: now,
      instructionCharsInjected: prev.instructionCharsInjected + added,
    };
  }
  const next: SpaceSkillAnalytics = {
    schemaVersion: 1,
    spaceId,
    updatedAt: now,
    turnsRecorded: cur.turnsRecorded + 1,
    totalEstimatedSkillPromptChars:
      cur.totalEstimatedSkillPromptChars + metrics.skillsSectionTotalChars,
    bySkillId,
  };
  await atomicWriteJson(spaceFile(spaceId, "skill-analytics.json", userId), next);
}
