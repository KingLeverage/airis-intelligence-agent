import { getDefaultModelId } from "../../config.js";
import { completeAnthropicOneShot } from "../../llm/anthropic-one-shot.js";
import { openAiCompatibleComplete } from "../../llm/openai-compatible-chat.js";
import { resolveLlmRuntime } from "../../llm/resolve-llm-runtime.js";
import { formatCliOutputAsReadable } from "./format-cli-output.js";

const MAX_LLM_STDOUT = 85_000;
const MAX_LLM_STDERR = 8_000;

/** When false, skip the extra LLM call (heuristic text only). Default: on unless explicitly disabled. */
export function isCliSummaryLlmEnabled(): boolean {
  const v = process.env.AIRIS_CLI_SUMMARY_LLM?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

function buildUserPayload(commandLine: string, stdout: string, stderr: string): string {
  const out = stdout.slice(0, MAX_LLM_STDOUT);
  const err = stderr.slice(0, MAX_LLM_STDERR);
  return `Command:\n${commandLine}\n\nStderr (diagnostics; may be empty):\n${err}\n\nStdout:\n${out}`;
}

const SYSTEM = `You are summarizing output from Printing Press–style CLIs (CoinGecko, Docker Hub, PyPI, Recipe Goat, etc.) for an operator who wants a **post-run narrative**: confident, structured, and easy to scan.

Write in clear plain English. Use **short titled sections** (e.g. "What ran", "Results", "Notable rows", "Errors / next steps"). Prefer bullet lists for facts drawn from stdout/stderr.

**Tone:** professional and direct, similar to a good Claude tool result — helpful interpretation without fluff. If the command failed or stderr has diagnostics, lead with that and what to try next (flags, env, install path) only when the output hints at it; do not invent fixes.

**Facts:** Do not invent data. If the output is JSON or many records, explain what the structure represents, give **2–4 concrete examples** (names, ids, versions), and state approximate counts if obvious — never dump the full JSON.

**Formatting:** No markdown code fence around the entire answer. Stay under 2500 words.`;

/**
 * Produces readable text: optional LLM pass (same billing as normal AIRIS chat: your Anthropic / OpenRouter / OpenAI keys),
 * falling back to deterministic formatting if the model is unavailable or errors.
 */
export async function buildReadableSummary(params: {
  userId: string;
  /** Resolved model id (e.g. space default or AIRIS_CLI_SUMMARY_MODEL_ID). */
  modelId: string;
  commandLine: string;
  stdout: string;
  stderr: string;
}): Promise<string> {
  const heuristic = formatCliOutputAsReadable(params.stdout, params.stderr);
  if (!isCliSummaryLlmEnabled()) return heuristic;

  let rt = await resolveLlmRuntime(params.userId, params.modelId);
  if (rt.kind === "mock" || rt.kind === "unconfigured_openrouter") {
    rt = await resolveLlmRuntime(params.userId, "openrouter");
  }
  if (rt.kind === "mock" || rt.kind === "unconfigured_openrouter") return heuristic;

  const user = buildUserPayload(params.commandLine, params.stdout, params.stderr);

  try {
    if (rt.kind === "anthropic_env") {
      const model =
        process.env.AIRIS_CLI_SUMMARY_ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022";
      const text = await completeAnthropicOneShot({
        system: SYSTEM,
        user,
        apiKey: rt.apiKey,
        model,
        maxTokens: 4096,
      });
      const t = text.trim();
      return t.length > 0 ? t : heuristic;
    }

    if (rt.kind === "openai_env") {
      const text = await openAiCompatibleComplete({
        baseUrl: rt.baseUrl,
        apiKey: rt.apiKey,
        model: rt.model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      });
      const t = text.trim();
      return t.length > 0 ? t : heuristic;
    }

    if (rt.kind === "openrouter") {
      const extra: Record<string, string | undefined> = {};
      if (rt.referer) extra["HTTP-Referer"] = rt.referer;
      if (rt.title) extra["X-Title"] = rt.title;
      const text = await openAiCompatibleComplete({
        baseUrl: rt.baseUrl,
        apiKey: rt.apiKey,
        model: rt.model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        extraHeaders: extra,
      });
      const t = text.trim();
      return t.length > 0 ? t : heuristic;
    }
  } catch {
    return (
      heuristic +
      "\n\n(Natural-language summary via your workspace LLM failed; heuristic text is above. Check model id and API keys.)"
    );
  }

  return heuristic;
}

/** Model id used only for resolving which provider/key to use for CLI summaries. */
export function resolveSummaryModelId(spaceDefaultModelId: string | undefined): string {
  const env = process.env.AIRIS_CLI_SUMMARY_MODEL_ID?.trim();
  if (env) return env;
  const d = spaceDefaultModelId?.trim();
  if (d && d !== "mock") return d;
  return getDefaultModelId();
}
