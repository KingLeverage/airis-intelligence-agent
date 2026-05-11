import { getEmbeddingBaseUrlOverride, getEmbeddingModel } from "../config.js";
import { resolveOpenAiCompatAuth } from "./openai-compatible-auth.js";

function embeddingsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/embeddings`;
}

function stripUndefined(h: Record<string, string | undefined>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v !== undefined && v !== "") o[k] = v;
  }
  return o;
}

/**
 * Single-vector embedding via OpenAI-compatible `/v1/embeddings`.
 * Uses `AIRIS_EMBEDDING_MODEL` (required) and profile/env API keys from `resolveOpenAiCompatAuth`.
 */
export async function createTextEmbedding(userId: string, input: string): Promise<number[] | null> {
  try {
    const model = getEmbeddingModel();
    if (!model) return null;
    const auth = await resolveOpenAiCompatAuth(userId);
    if (!auth) return null;
    const base = (getEmbeddingBaseUrlOverride() || auth.baseUrl).replace(/\/$/, "");
    const text = input.length > 16_000 ? input.slice(0, 16_000) : input;
    if (!text.trim()) return null;

    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${auth.apiKey}`,
      ...stripUndefined(auth.extraHeaders ?? {}),
    };

    const res = await fetch(embeddingsUrl(base), {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`embeddings HTTP ${res.status}: ${err.slice(0, 400)}`);
    }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vec = data.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    return vec;
  } catch {
    return null;
  }
}
