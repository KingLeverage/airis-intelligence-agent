import type { ActiveSkillContext } from "@airis/shared";
import { getSpaceSkillConfig } from "./space-skill-service.js";
import { listSkillManifests, loadSkillInstructions, listSkillTemplateBasenames } from "./skill-discovery.js";
import { routeSkills } from "./skill-router.js";
import { DEFAULT_USER_ID } from "../config.js";

const MAX_INSTRUCTION_CHARS_PER_SKILL = 6_000;
const MAX_TOTAL_INSTRUCTION_CHARS = 14_000;

export async function buildActiveSkillContext(args: {
  spaceId: string;
  userId?: string;
  userMessage: string;
}): Promise<ActiveSkillContext> {
  const userId = args.userId ?? DEFAULT_USER_ID;
  const manifests = await listSkillManifests();
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const config = await getSpaceSkillConfig(args.spaceId, userId);
  const route = routeSkills(args.userMessage, config, byId);

  const activeSkills = route.activeSkillIds.map((id) => byId.get(id)).filter(Boolean) as typeof manifests;
  const loadedInstructionBodies: Record<string, string> = {};
  let budget = MAX_TOTAL_INSTRUCTION_CHARS;

  for (const id of route.activeSkillIds) {
    const r = await loadSkillInstructions(id);
    if (r.body == null) {
      if (r.warning) {
        loadedInstructionBodies[id] = `(_Skill instructions unavailable: ${r.warning}_)`;
      }
      continue;
    }
    let body = r.body;
    if (body.length > MAX_INSTRUCTION_CHARS_PER_SKILL) {
      body = `${body.slice(0, MAX_INSTRUCTION_CHARS_PER_SKILL)}\n\n…(truncated)`;
    }
    if (body.length > budget) {
      body = `${body.slice(0, budget)}\n…(truncated for prompt budget)`;
    }
    budget -= body.length;
    loadedInstructionBodies[id] = body;
    if (budget <= 0) break;
  }

  return {
    activeSkillIds: route.activeSkillIds,
    activeSkills,
    loadedInstructionBodies,
    routingReasons: route.reasons,
  };
}

export function formatSkillDiscoverySection(args: {
  enabledManifests: import("@airis/shared").SkillManifest[];
  catalogManifests: import("@airis/shared").SkillManifest[];
}): string {
  const lines: string[] = [];
  lines.push("### Active in this space (enabled and/or pinned)");
  if (args.enabledManifests.length === 0) {
    lines.push("- _(none — open Skills in the top bar to add capabilities)_");
  } else {
    for (const m of args.enabledManifests) {
      const hint = m.promptHint ? ` — ${m.promptHint}` : "";
      lines.push(`- **${m.id}** (${m.name}): ${m.description}${hint}`);
    }
  }
  const enabledIds = new Set(args.enabledManifests.map((m) => m.id));
  const rest = args.catalogManifests.filter((m) => !enabledIds.has(m.id)).slice(0, 8);
  if (rest.length > 0) {
    lines.push("### Other installed skills (not enabled here)");
    for (const m of rest) {
      lines.push(`- **${m.id}**: ${m.description.slice(0, 160)}${m.description.length > 160 ? "…" : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatSkillActivationSection(ctx: ActiveSkillContext): string {
  if (ctx.activeSkillIds.length === 0) {
    return "### Active skill instructions\n\n_(No skills routed for this message; use space defaults and registry.)";
  }
  const blocks: string[] = ["### Active skill instructions", ""];
  for (const id of ctx.activeSkillIds) {
    const m = ctx.activeSkills.find((s) => s.id === id);
    const title = m ? `${m.name} (\`${id}\`)` : `\`${id}\``;
    const body = ctx.loadedInstructionBodies[id] ?? "_(no body)_";
    blocks.push(`#### ${title}`, "", body, "");
  }
  return blocks.join("\n");
}

export async function formatSkillTemplateHints(skillIds: string[]): Promise<string> {
  const lines: string[] = [];
  for (const id of skillIds) {
    const names = await listSkillTemplateBasenames(id);
    if (names.length === 0) continue;
    lines.push(`- \`${id}\`: templates ${names.map((n) => `\`${n}\``).join(", ")}`);
  }
  if (lines.length === 0) return "";
  return `### Skill-linked templates (JSON files on disk; use as structural hints)\n${lines.join("\n")}`;
}
