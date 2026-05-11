import type { SkillManifest, SpaceSkillConfig } from "@airis/shared";

const MAX_ROUTED_SKILLS = 5;

export type SkillRouteResult = {
  activeSkillIds: string[];
  reasons: string[];
};

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

/**
 * Deterministic routing: pinned first, then trigger / keyword overlap, then explicit id or name mention.
 */
export function routeSkills(
  userMessage: string,
  config: SpaceSkillConfig,
  manifestsById: Map<string, SkillManifest>,
): SkillRouteResult {
  const reasons: string[] = [];
  const active: string[] = [];
  const seen = new Set<string>();
  const msgLower = userMessage.toLowerCase();
  const words = new Set(normalizeWords(userMessage));

  const push = (id: string, reason: string) => {
    if (!manifestsById.has(id)) return;
    if (seen.has(id)) return;
    if (active.length >= MAX_ROUTED_SKILLS) return;
    seen.add(id);
    active.push(id);
    reasons.push(reason);
  };

  const enabled = new Set(config.enabledSkillIds);
  const impliedEnabled = new Set(enabled);
  for (const id of config.pinnedSkillIds ?? []) {
    impliedEnabled.add(id);
  }

  for (const id of config.pinnedSkillIds ?? []) {
    if (impliedEnabled.has(id) || enabled.has(id)) {
      push(id, `pinned:${id}`);
    }
  }

  for (const id of config.enabledSkillIds) {
    const m = manifestsById.get(id);
    if (!m) continue;

    if (msgLower.includes(m.id) || msgLower.includes(m.id.replace(/-/g, " "))) {
      push(id, `mention_id:${id}`);
      continue;
    }
    const nameLower = m.name.toLowerCase();
    if (msgLower.includes(nameLower)) {
      push(id, `mention_name:${id}`);
      continue;
    }

    for (const t of m.triggers) {
      const tl = t.toLowerCase();
      if (tl.length >= 2 && msgLower.includes(tl)) {
        push(id, `trigger:${id}:${t}`);
        break;
      }
    }
  }

  for (const id of config.enabledSkillIds) {
    const m = manifestsById.get(id);
    if (!m) continue;
    if (seen.has(id)) continue;
    const tagHit = m.tags.some((t) => {
      const tl = t.toLowerCase();
      return tl.length >= 3 && (msgLower.includes(tl) || words.has(tl));
    });
    if (tagHit) {
      push(id, `tag:${id}`);
    }
  }

  return { activeSkillIds: active, reasons };
}
