import {
  capMaxCompletionTokens,
  openRouterModelContextWindow,
  OPENROUTER_DEFAULT_BASE,
} from "./openrouter-profile-utils.js";

export { OPENROUTER_DEFAULT_BASE } from "./openrouter-profile-utils.js";

/** OpenRouter chat models that return generated images on `message.images` when `modalities` includes `image`. */
const OPENROUTER_IMAGE_OUTPUT_MODELS = new Set<string>(["openai/gpt-5.4-image-2"]);

export function openRouterImageOutputModalities(model: string): readonly ["image", "text"] | undefined {
  const m = model.trim();
  return OPENROUTER_IMAGE_OUTPUT_MODELS.has(m) ? (["image", "text"] as const) : undefined;
}

/** True when the header / request `modelId` selects an OpenRouter image-output slug (e.g. `openrouter:openai/gpt-5.4-image-2`). */
export function modelIdUsesOpenRouterImageOutput(modelId: string | undefined): boolean {
  const id = modelId?.trim() ?? "";
  if (!id) return false;
  for (const slug of OPENROUTER_IMAGE_OUTPUT_MODELS) {
    if (id === `openrouter:${slug}`) return true;
  }
  return false;
}

/** OpenRouter image models use a smaller total context than the default cap in `capMaxCompletionTokens`. */
const OPENROUTER_IMAGE_MODEL_CONTEXT_WINDOW = 268_000;

/**
 * Image-output models reject huge prompts (e.g. long chat + full AIRIS system). Shrink before calling OpenRouter.
 * Token estimate is coarse; char budgets stay conservative vs the ~272k window.
 */
const OPENROUTER_IMAGE_MODEL_MAX_MESSAGES = 6;
const OPENROUTER_IMAGE_MODEL_SYSTEM_MAX_CHARS = 100_000;
const OPENROUTER_IMAGE_MODEL_TURN_MAX_CHARS = 16_000;
const OPENROUTER_IMAGE_MODEL_USER_MAX_CHARS = 16_000;

function clampOpenRouterImagePrompt(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const omitted = s.length - maxChars;
  return `${s.slice(0, maxChars)}\n\n…[truncated ${omitted} chars for image-model context limit]`;
}

export function prepareOpenRouterImageOutputChat(args: {
  system: string;
  userMessage: string;
  history: Array<{ role: string; content: string }>;
  baseHistoryLimit: number;
}): {
  system: string;
  userMessage: string;
  recentRows: { role: "user" | "assistant"; content: string }[];
} {
  const maxMsgs = Math.min(OPENROUTER_IMAGE_MODEL_MAX_MESSAGES, Math.max(1, args.baseHistoryLimit));
  const recentRows = args.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-maxMsgs)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: clampOpenRouterImagePrompt(m.content, OPENROUTER_IMAGE_MODEL_TURN_MAX_CHARS),
    }));
  return {
    system: clampOpenRouterImagePrompt(args.system, OPENROUTER_IMAGE_MODEL_SYSTEM_MAX_CHARS),
    userMessage: clampOpenRouterImagePrompt(args.userMessage, OPENROUTER_IMAGE_MODEL_USER_MAX_CHARS),
    recentRows,
  };
}

type RawAssistantMessage = {
  content?: unknown;
  images?: Array<{ image_url?: { url?: string } }>;
};

/** Normalize assistant `message` from OpenAI-compatible / OpenRouter chat completions (text + optional image URLs). */
export function formatOpenAiCompatibleAssistantMessage(msg: RawAssistantMessage | undefined): string {
  if (!msg) return "";
  const chunks: string[] = [];
  const c = msg.content;
  if (typeof c === "string" && c.trim()) chunks.push(c.trim());
  else if (Array.isArray(c)) {
    for (const part of c) {
      if (part && typeof part === "object" && "type" in part) {
        const p = part as { type?: string; text?: string };
        if (p.type === "text" && typeof p.text === "string" && p.text.trim()) chunks.push(p.text.trim());
      }
    }
  }
  if (msg.images?.length) {
    for (const img of msg.images) {
      const url = img.image_url?.url;
      if (typeof url === "string" && url.length > 0) {
        chunks.push(`\n\n![generated](${url})\n\n`);
      }
    }
  }
  return chunks.join("\n\n");
}

export type ChatMessageRow = { role: "user" | "assistant" | "system"; content: string };

export type OpenAiCompatibleRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessageRow[];
  temperature?: number;
  max_tokens?: number;
  extraHeaders?: Record<string, string | undefined>;
};

function completionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function completionMaxTokens(req: OpenAiCompatibleRequest): number | undefined {
  const image = Boolean(openRouterImageOutputModalities(req.model));
  const contextWindow = image
    ? OPENROUTER_IMAGE_MODEL_CONTEXT_WINDOW
    : openRouterModelContextWindow(req.model);
  return capMaxCompletionTokens({
    requested: req.max_tokens,
    messages: req.messages,
    contextWindow,
  });
}

function httpErrorLabel(baseUrl: string, status: number): string {
  const host = baseUrl.includes("openrouter") ? "OpenRouter" : "LLM (OpenAI-compatible API)";
  return `${host} HTTP ${status}`;
}

export async function openAiCompatibleComplete(req: OpenAiCompatibleRequest): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${req.apiKey}`,
    ...stripUndefined(req.extraHeaders),
  };

  const maxOut = completionMaxTokens(req);
  const modalities = openRouterImageOutputModalities(req.model);
  const res = await fetch(completionsUrl(req.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      ...(maxOut !== undefined ? { max_tokens: maxOut } : {}),
      ...(modalities ? { modalities: [...modalities] } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${httpErrorLabel(req.baseUrl, res.status)}: ${err.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: RawAssistantMessage }>;
  };
  return formatOpenAiCompatibleAssistantMessage(data.choices?.[0]?.message);
}

export async function* openAiCompatibleStream(
  req: OpenAiCompatibleRequest,
): AsyncGenerator<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${req.apiKey}`,
    ...stripUndefined(req.extraHeaders),
  };

  const maxOut = completionMaxTokens(req);
  const modalities = openRouterImageOutputModalities(req.model);
  const res = await fetch(completionsUrl(req.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      ...(maxOut !== undefined ? { max_tokens: maxOut } : {}),
      ...(modalities ? { modalities: [...modalities] } : {}),
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`${httpErrorLabel(req.baseUrl, res.status)} (stream): ${err.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const emittedImageUrls = new Set<string>();
  let sawDeltaText = false;
  function* yieldNewImageMarkdown(images: RawAssistantMessage["images"] | undefined): Generator<string> {
    if (!images?.length) return;
    for (const img of images) {
      const url = img.image_url?.url;
      if (typeof url !== "string" || !url.length || emittedImageUrls.has(url)) continue;
      emittedImageUrls.add(url);
      yield `\n\n![generated](${url})\n\n`;
    }
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const block of parts) {
      for (const line of block.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const json = t.slice(5).trim();
        if (json === "[DONE]") continue;
        try {
          const ev = JSON.parse(json) as {
            choices?: Array<{
              delta?: { content?: string | null; images?: RawAssistantMessage["images"] };
              message?: RawAssistantMessage;
            }>;
          };
          const ch = ev.choices?.[0];
          const d = ch?.delta;
          const c = d?.content;
          if (typeof c === "string" && c.length > 0) {
            sawDeltaText = true;
            yield c;
          }
          yield* yieldNewImageMarkdown(d?.images);
          const m = ch?.message;
          if (m) {
            yield* yieldNewImageMarkdown(m.images);
            if (!sawDeltaText) {
              const textOnly = formatOpenAiCompatibleAssistantMessage({
                content: m.content,
                images: undefined,
              });
              if (textOnly.trim()) yield textOnly;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function stripUndefined(h?: Record<string, string | undefined>): Record<string, string> {
  const o: Record<string, string> = {};
  if (!h) return o;
  for (const [k, v] of Object.entries(h)) {
    if (v !== undefined && v !== "") o[k] = v;
  }
  return o;
}

export async function fetchOpenRouterModelsList(opts: {
  apiKey: string;
  baseUrl?: string;
}): Promise<{ ok: true; count: number } | { ok: false; status: number; message: string }> {
  const base = (opts.baseUrl ?? OPENROUTER_DEFAULT_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}/models`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, message: t.slice(0, 400) };
  }
  const data = (await res.json()) as { data?: unknown[] };
  const count = Array.isArray(data.data) ? data.data.length : 0;
  return { ok: true, count };
}
