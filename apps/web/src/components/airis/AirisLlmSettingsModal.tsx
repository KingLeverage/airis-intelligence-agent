import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LLM_MODEL_ID, DEFAULT_OPENROUTER_MODEL_SLUG } from "@airis/shared";
import { api, type ProfileLlmPutBody } from "../../lib/api";
import { useSessionStore } from "../../stores/session-store";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_ENDPOINT_DISPLAY = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL: string = DEFAULT_OPENROUTER_MODEL_SLUG;
/** Per-reply completion (output) budget — not total context. Large values are capped server-side to fit the model window. */
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_PARAMS = "temperature: 0.2\n";

/** Shown as completions on the OpenRouter “Model name” field (slug only, no `openrouter:` prefix). */
const OPENROUTER_MODEL_NAME_SUGGESTIONS = [
  "inclusionai/ring-2.6-1t:free",
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-5.4-image-2",
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-opus-4.7",
  "anthropic/claude-opus-4.7-fast",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
] as const;

function toStoredBase(displayUrl: string): string {
  let u = displayUrl.trim().replace(/\/$/, "");
  if (u.endsWith("/chat/completions")) u = u.slice(0, -"/chat/completions".length);
  return u || "https://openrouter.ai/api/v1";
}

function toDisplayEndpoint(storedBase?: string): string {
  const b = (storedBase?.trim() || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  return `${b}/chat/completions`;
}

function normalizeBudgetTriplet(sys: number, hist: number): { sys: number; hist: number; trans: number } {
  const s = Math.min(100, Math.max(0, Math.round(sys)));
  const h = Math.min(100, Math.max(0, Math.round(hist)));
  const sum = s + h;
  if (sum >= 100) {
    const scale = 99 / Math.max(1, sum);
    return {
      sys: Math.max(0, Math.round(s * scale)),
      hist: Math.max(0, Math.round(h * scale)),
      trans: Math.max(1, 100 - Math.round(s * scale) - Math.round(h * scale)),
    };
  }
  return { sys: s, hist: h, trans: 100 - s - h };
}

export function AirisLlmSettingsModal({ open, onClose }: Props) {
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [providerEndpoint, setProviderEndpoint] = useState(DEFAULT_ENDPOINT_DISPLAY);
  const [modelName, setModelName] = useState(DEFAULT_MODEL);
  const [siteUrl, setSiteUrl] = useState("");
  const [appName, setAppName] = useState("AIRIS");
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [budgetSys, setBudgetSys] = useState(30);
  const [budgetHist, setBudgetHist] = useState(40);
  const [singleHistPct, setSingleHistPct] = useState(10);
  const [paramsText, setParamsText] = useState(DEFAULT_PARAMS);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "save" | "validate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const budgetTrans = Math.max(0, 100 - budgetSys - budgetHist);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      const m = await api.getProfileLlm();
      const or = m.openrouter;
      setKeyHint(or?.configured && or.keySuffix ? `Saved key ends with ${or.keySuffix}` : null);
      setProviderEndpoint(toDisplayEndpoint(or?.providerBaseUrl));
      setModelName(or?.defaultModel ?? DEFAULT_MODEL);
      setSiteUrl(or?.siteUrl ?? "");
      setAppName(or?.appName ?? "AIRIS");
      setMaxTokens(or?.maxTokens ?? DEFAULT_MAX_TOKENS);
      setBudgetSys(or?.promptBudgetSystemPct ?? 30);
      setBudgetHist(or?.promptBudgetHistoryPct ?? 40);
      setSingleHistPct(or?.singleHistoryMessagePct ?? 10);
      setParamsText(or?.paramsText ?? DEFAULT_PARAMS);
      setApiKeyDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const applyDefaults = () => {
    setProviderEndpoint(DEFAULT_ENDPOINT_DISPLAY);
    setModelName(DEFAULT_MODEL);
    setMaxTokens(DEFAULT_MAX_TOKENS);
    setBudgetSys(30);
    setBudgetHist(40);
    setSingleHistPct(10);
    setParamsText(DEFAULT_PARAMS);
    setMessage(null);
    setError(null);
  };

  const onSave = async () => {
    setBusy("save");
    setMessage(null);
    setError(null);
    const willHaveOpenRouterKey = Boolean(apiKeyDraft.trim() || keyHint);
    try {
      const b = normalizeBudgetTriplet(budgetSys, budgetHist);
      const openrouter: NonNullable<ProfileLlmPutBody["openrouter"]> = {
        defaultModel: modelName.trim() || null,
        siteUrl: siteUrl.trim() || null,
        appName: appName.trim() || null,
        providerBaseUrl: toStoredBase(providerEndpoint) || null,
        maxTokens: maxTokens,
        promptBudgetSystemPct: b.sys,
        promptBudgetHistoryPct: b.hist,
        promptBudgetTransientPct: b.trans,
        singleHistoryMessagePct: singleHistPct,
        paramsText: paramsText.trim() || null,
      };
      if (apiKeyDraft.trim()) {
        openrouter.apiKey = apiKeyDraft.trim();
      }
      await api.putProfileLlm({ openrouter });
      setApiKeyDraft("");
      await load();
      const slug = (modelName.trim() || DEFAULT_OPENROUTER_MODEL_SLUG).replace(/^openrouter:/, "");
      const nextPicker = `openrouter:${slug}`;
      if (willHaveOpenRouterKey) {
        useSessionStore.getState().setModelId(nextPicker);
        setMessage(
          `Settings saved. Header **Model** is now **${nextPicker}** so the CLI and chat call OpenRouter (not mock).`,
        );
      } else {
        setMessage(
          "Saved. Add an **API key** and save again — then we will switch the header model to OpenRouter automatically.",
        );
      }
      window.dispatchEvent(new CustomEvent("airis-llm-profile-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onClearKey = async () => {
    if (!window.confirm("Remove the saved OpenRouter API key from this machine?")) return;
    setBusy("save");
    setMessage(null);
    setError(null);
    try {
      await api.putProfileLlm({ clearOpenrouter: true });
      await load();
      const mid = useSessionStore.getState().modelId;
      if (mid === "openrouter" || mid.startsWith("openrouter:")) {
        useSessionStore.getState().setModelId(DEFAULT_LLM_MODEL_ID);
      }
      setMessage(
        "OpenRouter key cleared. Header **Model** is set to the product default (Nemotron on OpenRouter). Add a key again to call the API.",
      );
      window.dispatchEvent(new CustomEvent("airis-llm-profile-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onValidate = async () => {
    setBusy("validate");
    setMessage(null);
    setError(null);
    try {
      const r = await api.postValidateOpenRouter({
        ...(apiKeyDraft.trim() ? { apiKey: apiKeyDraft.trim() } : {}),
        providerBaseUrl: toStoredBase(providerEndpoint),
      });
      setMessage(`Key OK · OpenRouter returned ${r.modelCount} models (no chat completion).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="airis-llm-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="airis-glass-1 flex max-h-[min(94vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--airis-border-glass-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.5)] px-5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--airis-text-tertiary)]">
            Settings
          </div>
          <h2
            id="airis-llm-settings-title"
            className="mt-1 text-sm font-semibold text-[color:var(--airis-text-primary)]"
          >
            Model, credentials, params, and instructions
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-[color:var(--airis-border-glass)] px-4 pt-2">
          <div className="rounded-t-lg px-4 py-2 text-xs font-medium bg-[color:rgba(45,212,191,0.12)] text-cyan-100 ring-1 ring-cyan-500/40 ring-b-transparent">
            API · OpenRouter
          </div>
          <button
            type="button"
            disabled
            title="Offline mock mode is paused — use OpenRouter with an API key."
            className="cursor-not-allowed rounded-t-lg px-4 py-2 text-xs font-medium text-[color:var(--airis-text-tertiary)] opacity-45"
          >
            Local (paused)
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
              <p className="text-[11px] leading-relaxed text-[color:var(--airis-text-secondary)]">
                OpenRouter and compatible endpoints. After saving, pick{" "}
                <span className="font-mono text-cyan-200/90">openrouter:…</span> or{" "}
                <span className="font-mono text-cyan-200/90">openrouter</span> (uses the model name below) in the
                header.{" "}
                <a
                  className="text-cyan-400 underline decoration-cyan-500/50 hover:text-cyan-300"
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noreferrer"
                >
                  Browse models ↗
                </a>
              </p>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Provider API endpoint URL
                </span>
                <input
                  type="url"
                  value={providerEndpoint}
                  onChange={(e) => setProviderEndpoint(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 font-mono text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Model name
                </span>
                <input
                  type="text"
                  list="airis-openrouter-model-suggestions"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 font-mono text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                  spellCheck={false}
                />
                <datalist id="airis-openrouter-model-suggestions">
                  {OPENROUTER_MODEL_NAME_SUGGESTIONS.map((slug) => (
                    <option key={slug} value={slug} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  API key
                </span>
                {keyHint ? (
                  <p className="mt-0.5 text-[10px] text-[color:var(--airis-text-tertiary)]">{keyHint}</p>
                ) : null}
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder={keyHint ? "Leave blank to keep saved key — paste only to replace" : "sk-or-…"}
                  className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 font-mono text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                />
                <p className="mt-1 text-[10px] text-[color:var(--airis-text-tertiary)]">
                  The field clears after save on purpose: the key is kept only in your server&apos;s data folder and is
                  never shown again. {keyHint ? "Your saved key is still active." : "Save once with a key to enable API."}
                </p>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Max tokens
                </span>
                <input
                  type="number"
                  min={1024}
                  max={2_000_000}
                  step={1024}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value) || DEFAULT_MAX_TOKENS)}
                  className="mt-1 w-full max-w-[12rem] rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 font-mono text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                />
                <p className="mt-1 text-[10px] leading-relaxed text-[color:var(--airis-text-tertiary)]">
                  This is the OpenAI/OpenRouter field <span className="font-mono">max_tokens</span>: the <strong>most
                  tokens the model may write in one reply</strong>, not your whole context size. Setting it near
                  128000 makes the API add input + output and reject the request. Default {DEFAULT_MAX_TOKENS.toLocaleString()}; the server also clamps to stay within the model window.
                </p>
              </label>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Prompt budget
                </div>
                <p className="mt-1 text-[10px] text-[color:var(--airis-text-tertiary)]">
                  System + history + transient rebalance to 100%. History share scales how many past chat turns are
                  included (approximate).
                </p>
                <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-slate-600/40">
                  <div
                    className="bg-slate-500/90"
                    style={{ width: `${budgetSys}%` }}
                    title={`System ${budgetSys}%`}
                  />
                  <div
                    className="bg-cyan-600/85"
                    style={{ width: `${budgetHist}%` }}
                    title={`History ${budgetHist}%`}
                  />
                  <div
                    className="bg-emerald-600/75"
                    style={{ width: `${budgetTrans}%` }}
                    title={`Transient ${budgetTrans}%`}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[10px] text-[color:var(--airis-text-secondary)]">
                    System {budgetSys}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={budgetSys}
                      onChange={(e) => setBudgetSys(Number(e.target.value))}
                      className="mt-1 block w-full accent-cyan-500"
                    />
                  </label>
                  <label className="text-[10px] text-[color:var(--airis-text-secondary)]">
                    History {budgetHist}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={budgetHist}
                      onChange={(e) => setBudgetHist(Number(e.target.value))}
                      className="mt-1 block w-full accent-cyan-400"
                    />
                  </label>
                  <div className="text-[10px] text-[color:var(--airis-text-tertiary)] sm:col-span-2">
                    Transient <span className="font-mono text-emerald-300/90">{budgetTrans}%</span> (remainder)
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Single history message {singleHistPct}%
                </span>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={singleHistPct}
                  onChange={(e) => setSingleHistPct(Number(e.target.value))}
                  className="mt-1 block w-full max-w-md accent-slate-400"
                />
                <p className="mt-1 text-[10px] text-[color:var(--airis-text-tertiary)]">
                  Reserved for future compaction tuning; stored with your profile.
                </p>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                  Params
                </span>
                <textarea
                  value={paramsText}
                  onChange={(e) => setParamsText(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  className="mt-1 w-full resize-y rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                  placeholder={"temperature: 0.2\nmax_tokens: 4096"}
                />
                <p className="mt-1 text-[10px] text-[color:var(--airis-text-tertiary)]">
                  One <span className="font-mono">key: value</span> per line. <span className="font-mono">temperature</span>{" "}
                  is applied to requests; <span className="font-mono">max_tokens</span> here is optional if you set Max
                  tokens above.
                </p>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] text-[color:var(--airis-text-secondary)]">
                  HTTP-Referer (optional)
                  <input
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://localhost:5173"
                    className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                  />
                </label>
                <label className="text-[10px] text-[color:var(--airis-text-secondary)]">
                  X-Title (optional)
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.85)] px-3 py-2 text-[11px] text-[color:var(--airis-text-primary)] outline-none focus:border-cyan-600/50"
                  />
                </label>
              </div>
            </div>
        </div>

        {message ? (
          <div className="shrink-0 border-t border-[color:var(--airis-border-glass)] px-5 py-2 text-[12px] text-emerald-300/95">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="shrink-0 border-t border-rose-900/40 px-5 py-2 text-[12px] text-rose-300/95">{error}</div>
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[color:var(--airis-border-glass)] bg-[color:rgba(4,10,18,0.55)] px-5 py-3">
            <button
                type="button"
                disabled={busy !== null}
                onClick={applyDefaults}
                className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-2 text-[11px] font-medium text-[color:var(--airis-text-secondary)] hover:bg-[color:rgba(255,255,255,0.05)] disabled:opacity-40"
              >
                Defaults
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onValidate()}
                className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-2 text-[11px] font-medium text-[color:var(--airis-text-primary)] hover:border-cyan-600/50 disabled:opacity-40"
              >
                {busy === "validate" ? "Checking…" : "Check API key"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onClearKey()}
                className="rounded-lg border border-rose-900/50 px-3 py-2 text-[11px] font-medium text-rose-200/90 hover:bg-rose-950/25 disabled:opacity-40"
              >
                Clear key
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onClose}
                className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-2 text-[11px] font-medium text-[color:var(--airis-text-secondary)] hover:bg-[color:rgba(255,255,255,0.05)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onSave()}
                className="rounded-lg bg-cyan-600/90 px-4 py-2 text-[11px] font-semibold text-slate-950 shadow-sm hover:bg-cyan-500 disabled:opacity-40"
              >
                {busy === "save" ? "Saving…" : "Save settings"}
              </button>
        </div>
      </div>
    </div>
  );
}
