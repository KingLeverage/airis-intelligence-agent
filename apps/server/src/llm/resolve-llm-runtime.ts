import { getDefaultModelId } from "../config.js";
import { readProfileLlm } from "../persistence/profile-llm-store.js";
import {
  historyMessageLimitFromBudget,
  normalizeOpenRouterProviderBase,
  parseParamsText,
} from "./openrouter-profile-utils.js";

export type LlmRuntime =
  | { kind: "mock" }
  | {
      kind: "openrouter";
      apiKey: string;
      baseUrl: string;
      model: string;
      referer?: string;
      title?: string;
      temperature: number;
      max_tokens?: number;
      historyLimit: number;
    }
  | { kind: "openai_env"; apiKey: string; baseUrl: string; model: string }
  | { kind: "anthropic_env"; apiKey: string; model: string };

const OPENROUTER_PREFIX = "openrouter:";

function buildOpenRouterRuntime(
  profile: Awaited<ReturnType<typeof readProfileLlm>>,
  model: string,
): LlmRuntime | null {
  const key = profile.openrouter?.apiKey;
  if (!key) return null;
  const or = profile.openrouter;
  const baseUrl = normalizeOpenRouterProviderBase(or?.providerBaseUrl);
  const parsed = parseParamsText(or?.paramsText);
  const max_tokens = or?.maxTokens ?? parsed.max_tokens;
  const temperature = parsed.temperature ?? 0.7;
  const historyLimit = historyMessageLimitFromBudget(or?.promptBudgetHistoryPct);
  return {
    kind: "openrouter",
    apiKey: key,
    baseUrl,
    model,
    referer: or?.siteUrl?.trim() || undefined,
    title: or?.appName?.trim() || undefined,
    temperature,
    ...(max_tokens !== undefined ? { max_tokens } : {}),
    historyLimit,
  };
}

export async function resolveLlmRuntime(userId: string, modelId: string | undefined): Promise<LlmRuntime> {
  const id = (modelId ?? getDefaultModelId()).trim();
  if (id === "mock") return { kind: "mock" };

  const profile = await readProfileLlm(userId);

  if (id.startsWith(OPENROUTER_PREFIX)) {
    const slug = id.slice(OPENROUTER_PREFIX.length).trim();
    const model =
      slug || profile.openrouter?.defaultModel?.trim() || "openai/gpt-4o-mini";
    const r = buildOpenRouterRuntime(profile, model);
    return r ?? { kind: "mock" };
  }

  if (id === "openrouter") {
    const dm = profile.openrouter?.defaultModel?.trim();
    if (!dm) return { kind: "mock" };
    const r = buildOpenRouterRuntime(profile, dm);
    return r ?? { kind: "mock" };
  }

  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey && id !== "openai") {
    return {
      kind: "anthropic_env",
      apiKey: anthKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    };
  }

  const oaiKey = process.env.OPENAI_API_KEY;
  if (oaiKey) {
    return {
      kind: "openai_env",
      apiKey: oaiKey,
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  return { kind: "mock" };
}
