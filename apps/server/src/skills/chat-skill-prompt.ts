import type { BrowserPageTranscription, BrowserSession, SkillPromptMetrics } from "@airis/shared";
import * as spaceStore from "../persistence/space-store.js";
import { buildFullSystemPrompt } from "../llm/prompt-builder.js";
import {
  buildActiveSkillContext,
  formatSkillActivationSection,
  formatSkillDiscoverySection,
  formatSkillTemplateHints,
} from "./active-skill-context.js";
import { getSpaceSkillConfig } from "./space-skill-service.js";
import { listSkillManifests } from "./skill-discovery.js";
import { DEFAULT_USER_ID, isCliToolsRunEnabled } from "../config.js";
import { buildReferenceLibraryRagMarkdown } from "../persistence/reference-library-rag.js";
import { buildPrintingPressCliSkillsPromptSection } from "../services/cli-tools/printing-press-skills-prompt.js";

type SpaceBundle = NonNullable<Awaited<ReturnType<typeof spaceStore.loadSpaceBundle>>>;

export async function composeSystemPromptWithSkills(
  bundle: SpaceBundle,
  opts: {
    spaceId: string;
    userId?: string;
    userMessage: string;
    browserTranscription?: BrowserPageTranscription | null;
    browserPromptContext?: string | null;
    browserSession?: BrowserSession | null;
    lastExecutionSummary?: string | null;
  },
): Promise<{
  system: string;
  activeSkillIds: string[];
  routingReasons: string[];
  skillPromptMetrics: SkillPromptMetrics;
}> {
  const userId = opts.userId ?? DEFAULT_USER_ID;
  const skillCtx = await buildActiveSkillContext({
    spaceId: opts.spaceId,
    userId,
    userMessage: opts.userMessage,
  });
  const manifests = await listSkillManifests();
  const cfg = await getSpaceSkillConfig(opts.spaceId, userId);
  const activeForSpace = new Set([
    ...cfg.enabledSkillIds,
    ...(cfg.pinnedSkillIds ?? []).filter(Boolean),
  ]);
  const enabledManifests = manifests.filter((m) => activeForSpace.has(m.id));
  const discovery = formatSkillDiscoverySection({
    enabledManifests,
    catalogManifests: manifests,
  });
  const activation = formatSkillActivationSection(skillCtx);
  const templateHints = await formatSkillTemplateHints(skillCtx.activeSkillIds);

  const allSpaces = await spaceStore.listSpacesMeta(userId);
  const spacesCatalog = allSpaces.slice(0, 80).map((s) => ({
    id: s.id,
    name: s.name,
    demo: Boolean(s.demo),
  }));

  const referenceLibraryMarkdown = await buildReferenceLibraryRagMarkdown(userId, opts.userMessage);

  const printingPressCliSkillsMarkdown = isCliToolsRunEnabled()
    ? buildPrintingPressCliSkillsPromptSection()
    : "";

  const system = buildFullSystemPrompt(bundle, {
    browserTranscription: opts.browserTranscription ?? null,
    browserPromptContext: opts.browserPromptContext ?? null,
    browserSession: opts.browserSession ?? null,
    lastExecutionSummary: opts.lastExecutionSummary ?? null,
    skillDiscoveryMarkdown: discovery,
    skillActivationMarkdown: activation,
    skillTemplateHints: templateHints || undefined,
    spacesCatalog,
    referenceLibraryMarkdown: referenceLibraryMarkdown || undefined,
    printingPressCliSkillsMarkdown: printingPressCliSkillsMarkdown || undefined,
  });

  const templateHintsChars = (templateHints || "").length;
  const perSkillInstructionChars: Record<string, number> = {};
  for (const id of skillCtx.activeSkillIds) {
    const body = skillCtx.loadedInstructionBodies[id];
    if (typeof body === "string") perSkillInstructionChars[id] = body.length;
  }
  const skillPromptMetrics: SkillPromptMetrics = {
    discoveryChars: discovery.length,
    activationChars: activation.length,
    templateHintsChars,
    skillsSectionTotalChars: discovery.length + activation.length + templateHintsChars,
    activeSkillIds: skillCtx.activeSkillIds,
    perSkillInstructionChars,
  };

  return {
    system,
    activeSkillIds: skillCtx.activeSkillIds,
    routingReasons: skillCtx.routingReasons,
    skillPromptMetrics,
  };
}
