export const OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1";

/** Accept base `…/v1` or full `…/v1/chat/completions` URL from UI. */
export function normalizeOpenRouterProviderBase(url: string | undefined): string {
  if (!url?.trim()) return OPENROUTER_DEFAULT_BASE;
  let u = url.trim().replace(/\/$/, "");
  if (u.endsWith("/chat/completions")) {
    u = u.slice(0, -"/chat/completions".length);
  }
  return u || OPENROUTER_DEFAULT_BASE;
}

export function parseParamsText(s: string | undefined): { temperature?: number; max_tokens?: number } {
  const out: { temperature?: number; max_tokens?: number } = {};
  if (!s?.trim()) return out;
  for (const line of s.split("\n")) {
    const m = /^\s*([a-zA-Z_]+)\s*:\s*([\d.]+)\s*$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = Number(m[2]);
    if (!Number.isFinite(v)) continue;
    if (k === "temperature") out.temperature = v;
    if (k === "max_tokens") out.max_tokens = Math.round(v);
  }
  return out;
}

/** Reference: 40% history budget ≈ 24 messages; scale linearly, clamp 2–32 (OpenRouter turns can be huge). */
export function historyMessageLimitFromBudget(historyPct: number | undefined): number {
  const pct = typeof historyPct === "number" && Number.isFinite(historyPct) ? historyPct : 40;
  const n = Math.round(24 * (pct / 40));
  return Math.min(32, Math.max(2, n));
}

/**
 * OpenAI-compatible APIs use `max_tokens` as the **completion (output) budget** for this request, not total context.
 * Requesting ~128k output plus a multi‑k prompt exceeds a 128k window and yields HTTP 400 from OpenRouter.
 */
export function capMaxCompletionTokens(opts: {
  requested: number | undefined;
  messages: Array<{ content: string }>;
  /** Total context window upper bound (conservative). */
  contextWindow?: number;
  /** Hard ceiling per reply even when the window allows more. */
  hardCap?: number;
}): number | undefined {
  if (opts.requested === undefined || !Number.isFinite(opts.requested)) return undefined;
  const win = opts.contextWindow ?? 128_000;
  const hardCap = opts.hardCap ?? 16_384;
  const approxIn = Math.ceil(
    opts.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0) / 3.2,
  );
  const margin = 2048;
  const room = Math.max(256, win - approxIn - margin);
  const v = Math.min(Math.floor(opts.requested), room, hardCap);
  return v < 256 ? undefined : v;
}
