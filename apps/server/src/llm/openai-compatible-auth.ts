import { readProfileLlm } from "../persistence/profile-llm-store.js";
import { normalizeOpenRouterProviderBase, OPENROUTER_DEFAULT_BASE } from "./openrouter-profile-utils.js";

export type OpenAiCompatAuth = {
  apiKey: string;
  /** OpenAI-compatible API root ending in `/v1`. */
  baseUrl: string;
  /** Extra headers for OpenRouter (referer / title). */
  extraHeaders?: Record<string, string | undefined>;
};

/**
 * Prefer saved OpenRouter profile, then env OpenRouter, then OpenAI profile/env.
 */
export async function resolveOpenAiCompatAuth(userId: string): Promise<OpenAiCompatAuth | null> {
  const profile = await readProfileLlm(userId);
  const orKey = profile.openrouter?.apiKey?.trim();
  if (orKey) {
    const base = normalizeOpenRouterProviderBase(profile.openrouter?.providerBaseUrl);
    return {
      apiKey: orKey,
      baseUrl: base,
      extraHeaders: {
        "HTTP-Referer": profile.openrouter?.siteUrl?.trim() || "https://airis.local",
        "X-Title": profile.openrouter?.appName?.trim() || "AIRIS",
      },
    };
  }
  const envOr = process.env.OPENROUTER_API_KEY?.trim();
  if (envOr) {
    const raw = process.env.OPENROUTER_BASE_URL?.trim();
    const base = raw ? normalizeOpenRouterProviderBase(raw) : OPENROUTER_DEFAULT_BASE;
    return {
      apiKey: envOr,
      baseUrl: base,
      extraHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://airis.local",
        "X-Title": process.env.OPENROUTER_APP_NAME?.trim() || "AIRIS",
      },
    };
  }
  const oaKey = profile.openai?.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!oaKey) return null;
  const rawBase = profile.openai?.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  let base = rawBase.replace(/\/$/, "");
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return { apiKey: oaKey, baseUrl: base };
}
