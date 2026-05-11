import type { ChatMessage, SkillPromptMetrics } from "@airis/shared";
import { buildBrowserPromptContext } from "@airis/shared";
import * as store from "../persistence/space-store.js";
import * as browserSession from "../browser/session-store.js";
import { getDefaultModelId } from "../config.js";
import { DEFAULT_USER_ID } from "../config.js";
import { createModelAdapter } from "./adapters/index.js";
import { resolveLlmRuntime } from "./resolve-llm-runtime.js";
import { composeSystemPromptWithSkills } from "../skills/chat-skill-prompt.js";

export type RespondOptions = {
  spaceId: string;
  userId?: string;
  modelId?: string;
};

export type RespondResult = {
  text: string;
  activeSkillIds: string[];
  routingReasons: string[];
  skillPromptMetrics: SkillPromptMetrics;
};

export async function respond(
  history: ChatMessage[],
  userMessage: string,
  opts: RespondOptions,
): Promise<RespondResult> {
  const userId = opts.userId ?? DEFAULT_USER_ID;
  const bundle = await store.loadSpaceBundle(opts.spaceId, userId);
  if (!bundle) throw new Error("space_not_found");

  const bs = await browserSession.getSession(opts.spaceId, userId);
  const browser = bs.lastTranscription ?? null;
  const { system, activeSkillIds, routingReasons, skillPromptMetrics } =
    await composeSystemPromptWithSkills(bundle, {
    spaceId: opts.spaceId,
    userId,
    userMessage,
    browserTranscription: browser,
    browserPromptContext: buildBrowserPromptContext(bs),
    browserSession: bs,
  });

  const modelId = opts.modelId ?? getDefaultModelId();
  const runtime = await resolveLlmRuntime(userId, modelId);
  const adapter = createModelAdapter(runtime);
  const text = await adapter.complete({
    systemPrompt: system,
    history,
    userMessage,
    modelId,
  });
  return { text, activeSkillIds, routingReasons, skillPromptMetrics };
}
