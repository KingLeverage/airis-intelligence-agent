import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDataDir } from "../config.js";

const VERSION = 1 as const;

const OpenRouterStored = z.object({
  apiKey: z.string().min(1),
  /** OpenRouter model slug, e.g. anthropic/claude-3.5-sonnet */
  defaultModel: z.string().optional(),
  siteUrl: z.string().optional(),
  appName: z.string().optional(),
  /** Base URL only (e.g. https://openrouter.ai/api/v1); chat path is appended by the client. */
  providerBaseUrl: z.string().optional(),
  maxTokens: z.number().int().positive().max(2_000_000).optional(),
  promptBudgetSystemPct: z.number().min(0).max(100).optional(),
  promptBudgetHistoryPct: z.number().min(0).max(100).optional(),
  promptBudgetTransientPct: z.number().min(0).max(100).optional(),
  singleHistoryMessagePct: z.number().min(0).max(100).optional(),
  /** Lines like `temperature: 0.2` */
  paramsText: z.string().optional(),
});

/** Extension slots for future UI; not wired to LLM yet. */
const OpenAiStored = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
});

const AnthropicStored = z.object({
  apiKey: z.string().min(1),
  defaultModel: z.string().optional(),
});

export const ProfileLlmFileSchema = z.object({
  version: z.literal(VERSION).default(VERSION),
  openrouter: OpenRouterStored.optional(),
  openai: OpenAiStored.optional(),
  anthropic: AnthropicStored.optional(),
});

export type ProfileLlmFile = z.infer<typeof ProfileLlmFileSchema>;

export type ProfileLlmMasked = {
  version: typeof VERSION;
  openrouter?: {
    configured: boolean;
    keySuffix?: string;
    defaultModel?: string;
    siteUrl?: string;
    appName?: string;
    providerBaseUrl?: string;
    maxTokens?: number;
    promptBudgetSystemPct?: number;
    promptBudgetHistoryPct?: number;
    promptBudgetTransientPct?: number;
    singleHistoryMessagePct?: number;
    paramsText?: string;
  };
  openai?: { configured: boolean; keySuffix?: string; defaultModel?: string; baseUrl?: string };
  anthropic?: { configured: boolean; keySuffix?: string; defaultModel?: string };
};

function profileLlmPath(userId: string): string {
  return path.join(getDataDir(), "profiles", userId, "llm.json");
}

function keySuffix(key: string): string {
  const t = key.trim();
  if (t.length <= 4) return "****";
  return `…${t.slice(-4)}`;
}

export function maskProfileLlm(data: ProfileLlmFile): ProfileLlmMasked {
  const out: ProfileLlmMasked = { version: VERSION };
  if (data.openrouter?.apiKey) {
    const or = data.openrouter;
    out.openrouter = {
      configured: true,
      keySuffix: keySuffix(or.apiKey),
      defaultModel: or.defaultModel,
      siteUrl: or.siteUrl,
      appName: or.appName,
      providerBaseUrl: or.providerBaseUrl,
      maxTokens: or.maxTokens,
      promptBudgetSystemPct: or.promptBudgetSystemPct,
      promptBudgetHistoryPct: or.promptBudgetHistoryPct,
      promptBudgetTransientPct: or.promptBudgetTransientPct,
      singleHistoryMessagePct: or.singleHistoryMessagePct,
      paramsText: or.paramsText,
    };
  }
  if (data.openai?.apiKey) {
    out.openai = {
      configured: true,
      keySuffix: keySuffix(data.openai.apiKey),
      defaultModel: data.openai.defaultModel,
      baseUrl: data.openai.baseUrl,
    };
  }
  if (data.anthropic?.apiKey) {
    out.anthropic = {
      configured: true,
      keySuffix: keySuffix(data.anthropic.apiKey),
      defaultModel: data.anthropic.defaultModel,
    };
  }
  return out;
}

export async function readProfileLlm(userId: string): Promise<ProfileLlmFile> {
  const file = profileLlmPath(userId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const j = JSON.parse(raw) as unknown;
    const p = ProfileLlmFileSchema.safeParse(j);
    if (!p.success) return { version: VERSION };
    return p.data;
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : "";
    if (code === "ENOENT") return { version: VERSION };
    return { version: VERSION };
  }
}

export async function writeProfileLlm(userId: string, data: ProfileLlmFile): Promise<void> {
  const file = profileLlmPath(userId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const parsed = ProfileLlmFileSchema.parse(data);
  await fs.writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

/** Deep-merge PUT: omit apiKey fields to leave existing secrets unchanged. */
export async function mergeProfileLlm(
  userId: string,
  patch: {
    clearOpenrouter?: boolean;
    openrouter?: {
      apiKey?: string;
      defaultModel?: string | null;
      siteUrl?: string | null;
      appName?: string | null;
      providerBaseUrl?: string | null;
      maxTokens?: number | null;
      promptBudgetSystemPct?: number | null;
      promptBudgetHistoryPct?: number | null;
      promptBudgetTransientPct?: number | null;
      singleHistoryMessagePct?: number | null;
      paramsText?: string | null;
    };
    clearOpenai?: boolean;
    openai?: { apiKey?: string; defaultModel?: string | null; baseUrl?: string | null };
    clearAnthropic?: boolean;
    anthropic?: { apiKey?: string; defaultModel?: string | null };
  },
): Promise<ProfileLlmFile> {
  const cur = await readProfileLlm(userId);
  const next: ProfileLlmFile = { ...cur, version: VERSION };

  if (patch.clearOpenrouter) {
    delete next.openrouter;
  } else if (patch.openrouter) {
    const o = patch.openrouter;
    const prev = cur.openrouter;
    const apiKey =
      o.apiKey !== undefined && o.apiKey.trim() !== "" ? o.apiKey.trim() : prev?.apiKey;
    if (apiKey) {
      next.openrouter = {
        apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev?.defaultModel),
        siteUrl: metaCoalesce(o.siteUrl, prev?.siteUrl),
        appName: metaCoalesce(o.appName, prev?.appName),
        providerBaseUrl: metaCoalesce(o.providerBaseUrl, prev?.providerBaseUrl),
        maxTokens: metaNum(o.maxTokens, prev?.maxTokens),
        promptBudgetSystemPct: metaNum(o.promptBudgetSystemPct, prev?.promptBudgetSystemPct),
        promptBudgetHistoryPct: metaNum(o.promptBudgetHistoryPct, prev?.promptBudgetHistoryPct),
        promptBudgetTransientPct: metaNum(o.promptBudgetTransientPct, prev?.promptBudgetTransientPct),
        singleHistoryMessagePct: metaNum(o.singleHistoryMessagePct, prev?.singleHistoryMessagePct),
        paramsText: metaCoalesce(o.paramsText, prev?.paramsText),
      };
    } else if (prev) {
      next.openrouter = {
        apiKey: prev.apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev.defaultModel),
        siteUrl: metaCoalesce(o.siteUrl, prev.siteUrl),
        appName: metaCoalesce(o.appName, prev.appName),
        providerBaseUrl: metaCoalesce(o.providerBaseUrl, prev.providerBaseUrl),
        maxTokens: metaNum(o.maxTokens, prev.maxTokens),
        promptBudgetSystemPct: metaNum(o.promptBudgetSystemPct, prev.promptBudgetSystemPct),
        promptBudgetHistoryPct: metaNum(o.promptBudgetHistoryPct, prev.promptBudgetHistoryPct),
        promptBudgetTransientPct: metaNum(o.promptBudgetTransientPct, prev.promptBudgetTransientPct),
        singleHistoryMessagePct: metaNum(o.singleHistoryMessagePct, prev.singleHistoryMessagePct),
        paramsText: metaCoalesce(o.paramsText, prev.paramsText),
      };
    }
  }

  if (patch.clearOpenai) {
    delete next.openai;
  } else if (patch.openai) {
    const o = patch.openai;
    const prev = cur.openai;
    const apiKey =
      o.apiKey !== undefined && o.apiKey.trim() !== "" ? o.apiKey.trim() : prev?.apiKey;
    if (apiKey) {
      next.openai = {
        apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev?.defaultModel),
        baseUrl: metaCoalesce(o.baseUrl, prev?.baseUrl),
      };
    } else if (prev) {
      next.openai = {
        apiKey: prev.apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev.defaultModel),
        baseUrl: metaCoalesce(o.baseUrl, prev.baseUrl),
      };
    }
  }

  if (patch.clearAnthropic) {
    delete next.anthropic;
  } else if (patch.anthropic) {
    const o = patch.anthropic;
    const prev = cur.anthropic;
    const apiKey =
      o.apiKey !== undefined && o.apiKey.trim() !== "" ? o.apiKey.trim() : prev?.apiKey;
    if (apiKey) {
      next.anthropic = {
        apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev?.defaultModel),
      };
    } else if (prev) {
      next.anthropic = {
        apiKey: prev.apiKey,
        defaultModel: metaCoalesce(o.defaultModel, prev.defaultModel),
      };
    }
  }

  const validated = ProfileLlmFileSchema.parse(next);
  await writeProfileLlm(userId, validated);
  return validated;
}

/** undefined = leave prev; null = clear field */
function metaCoalesce(
  incoming: string | null | undefined,
  prev: string | undefined,
): string | undefined {
  if (incoming === null) return undefined;
  if (incoming === undefined) return prev;
  const t = incoming.trim();
  return t === "" ? undefined : t;
}

function metaNum(incoming: number | null | undefined, prev: number | undefined): number | undefined {
  if (incoming === null) return undefined;
  if (incoming === undefined) return prev;
  return incoming;
}

