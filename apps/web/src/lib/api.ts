import type {
  ChatMessage,
  ExecutionRecord,
  LayoutState,
  SpaceMeta,
  AirisTheme,
  WidgetRecord,
  WidgetLiveDataResponse,
  WidgetLoadWarning,
  BrowserPageTranscription,
  BrowserSession,
  SnapshotMeta,
  RecoverySummary,
  SpaceRecoveryDetail,
  SnapshotBundle,
  SpaceSkillConfig,
  SkillSummary,
  SpaceSkillAnalytics,
  SkillPromptMetrics,
  SkillManifest,
} from "@airis/shared";

const API = "";

export type ProfileLlmMasked = {
  version: 1;
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

export type ProfileLlmPutBody = {
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
};

function unwrapJson<T>(json: unknown): T {
  if (
    json &&
    typeof json === "object" &&
    "ok" in json &&
    (json as { ok: unknown }).ok === true &&
    "data" in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  const body = init?.body;
  const hasJsonBody = typeof body === "string" && body.length > 0;
  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    if (json && typeof json === "object" && "ok" in json && (json as { ok: unknown }).ok === false) {
      const er = json as { error?: { message?: string } };
      throw new Error(er.error?.message ?? `HTTP ${res.status}`);
    }
    const text =
      typeof json === "object" && json !== null ? JSON.stringify(json) : String(json ?? "");
    throw new Error(`${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  return unwrapJson<T>(json);
}

export type SpaceBundle = {
  space: SpaceMeta;
  settings: { theme?: AirisTheme; defaultModelId?: string };
  layout: LayoutState;
  widgets: WidgetRecord[];
  chat: ChatMessage[];
  instructions: string;
  widgetLoadWarnings: WidgetLoadWarning[];
};

export type CliToolCatalogEntry = {
  key: string;
  label: string;
  description: string;
  installHint: string;
  program: string;
  familyId: string;
  familyLabel: string;
};

/** Allowlisted basename for POST …/cli-tools/run custom argv (matches server). */
export type CliCatalogCustomProgram =
  | "coingecko-pp-cli"
  | "docker-hub-pp-cli"
  | "pypi-pp-cli"
  | "recipe-goat-pp-cli"
  | "espn-pp-cli"
  | "flight-goat-pp-cli"
  | "movie-goat-pp-cli"
  | "twilio-pp-cli"
  | "x-twitter-pp-cli";

export type CliToolRunResponse = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
  /** Echo of the argv line executed on the server. */
  commandLine?: string;
  /** JSON summarized into readable bullets when applicable; otherwise raw stdout. */
  readableSummary?: string;
};

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),

  browserCapabilities: () =>
    req<{ playwrightEnabled: boolean; previewUnsafeFullPage?: boolean }>("/api/browser/capabilities"),

  listSpaces: () => req<{ spaces: SpaceMeta[] }>("/api/spaces"),

  createSpace: (name: string) =>
    req<{ space: SpaceMeta }>("/api/spaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  deleteSpace: (spaceId: string) =>
    req<{ deleted: true }>(`/api/spaces/${spaceId}`, { method: "DELETE" }),

  cloneSpace: (spaceId: string) =>
    req<{ space: SpaceMeta }>(`/api/spaces/${spaceId}/clone`, { method: "POST" }),

  getSpace: (spaceId: string) => req<SpaceBundle>(`/api/spaces/${spaceId}`),

  putSpacePreview: (spaceId: string, imageBase64: string) =>
    req<{ space: SpaceMeta }>(`/api/spaces/${spaceId}/preview`, {
      method: "PUT",
      body: JSON.stringify({ imageBase64 }),
    }),

  listWidgets: (spaceId: string) =>
    req<{ widgets: WidgetRecord[]; loadWarnings: WidgetLoadWarning[] }>(`/api/spaces/${spaceId}/widgets`),

  createWidget: (
    spaceId: string,
    body: {
      kind: WidgetRecord["kind"];
      title: string;
      data?: Record<string, unknown>;
      layout?: { x: number; y: number; w: number; h: number };
    },
  ) =>
    req<{ widget: WidgetRecord }>(`/api/spaces/${spaceId}/widgets`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getCliToolCatalog: (spaceId: string) =>
    req<{
      tools: CliToolCatalogEntry[];
      runsEnabled: boolean;
      customPrograms: readonly string[];
    }>(`/api/spaces/${encodeURIComponent(spaceId)}/cli-tools/catalog`),

  runCliTool: (
    spaceId: string,
    body: { toolKey: string } | { program: CliCatalogCustomProgram; argsText: string },
  ) =>
    req<CliToolRunResponse>(`/api/spaces/${encodeURIComponent(spaceId)}/cli-tools/run`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getChat: (spaceId: string) => req<{ messages: ChatMessage[] }>(`/api/spaces/${spaceId}/chat`),

  clearChat: (spaceId: string) =>
    req<{ cleared: boolean }>(`/api/spaces/${spaceId}/chat`, { method: "DELETE" }),

  listSkills: () => req<{ skills: SkillSummary[] }>("/api/skills"),

  getSpaceSkills: (spaceId: string) =>
    req<{ config: SpaceSkillConfig; skills: SkillSummary[] }>(`/api/spaces/${spaceId}/skills`),

  putSpaceSkills: (
    spaceId: string,
    body: { enabledSkillIds?: string[]; pinnedSkillIds?: string[] },
  ) =>
    req<{ config: SpaceSkillConfig }>(`/api/spaces/${spaceId}/skills`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  enableSpaceSkill: (spaceId: string, skillId: string) =>
    req<{ config: SpaceSkillConfig }>(
      `/api/spaces/${spaceId}/skills/${encodeURIComponent(skillId)}/enable`,
      { method: "POST" },
    ),

  disableSpaceSkill: (spaceId: string, skillId: string) =>
    req<{ config: SpaceSkillConfig }>(
      `/api/spaces/${spaceId}/skills/${encodeURIComponent(skillId)}/disable`,
      { method: "POST" },
    ),

  getSpaceSkillAnalytics: (spaceId: string) =>
    req<{ analytics: SpaceSkillAnalytics }>(`/api/spaces/${spaceId}/skills/analytics`),

  listSkillDrafts: () =>
    req<{
      drafts: Array<{
        draftId: string;
        valid: boolean;
        errors: string[];
        warnings: string[];
        manifest: SkillManifest | null;
      }>;
    }>("/api/skills/drafts"),

  createSkillDraft: (body: { draftId: string; manifest: unknown; skillMd?: string }) =>
    req<{
      draft: {
        draftId: string;
        valid: boolean;
        errors: string[];
        warnings: string[];
        manifest: SkillManifest | null;
      };
    }>("/api/skills/drafts", { method: "POST", body: JSON.stringify(body) }),

  promoteSkillDraft: (draftId: string) =>
    req<{ skillId: string }>(`/api/skills/drafts/${encodeURIComponent(draftId)}/promote`, {
      method: "POST",
    }),

  deleteSkillDraft: (draftId: string) =>
    req<{ deleted: true }>(`/api/skills/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
    }),

  postChat: (spaceId: string, message: string, modelId?: string) =>
    req<{
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      execution: ExecutionRecord;
      results: {
        ok: boolean;
        message: string;
        detail?: string;
        browser?: { implemented: boolean; message: string };
      }[];
      widgets: WidgetRecord[];
      browserSession: BrowserSession;
      result?: { implemented: boolean; message: string };
      spaceDeletedAfterTurn?: boolean;
      activeSkillIds?: string[];
      skillRoutingReasons?: string[];
      skillPromptMetrics?: SkillPromptMetrics;
    }>(`/api/spaces/${spaceId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, modelId }),
    }),

  postChatStream: async (
    spaceId: string,
    content: string,
    modelId: string | undefined,
    handlers: {
      onDelta: (chunk: string, accumulated: string) => void;
      onDone: (payload: {
        message: ChatMessage;
        execution: ExecutionRecord;
        results: { ok: boolean; message: string; detail?: string }[];
        widgets?: WidgetRecord[];
        spaceDeletedAfterTurn?: boolean;
        activeSkillIds?: string[];
        skillRoutingReasons?: string[];
      }) => void;
      onError: (message: string) => void;
    },
  ): Promise<void> => {
    const res = await fetch(`${API}/api/spaces/${spaceId}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: content, modelId }),
    });
    if (!res.ok) {
      const text = await res.text();
      handlers.onError(`${res.status}: ${text.slice(0, 400)}`);
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      handlers.onError("No response body");
      return;
    }
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
    let sawDone = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: unknown;
        try {
          ev = JSON.parse(line) as {
            type?: string;
            text?: string;
            detail?: string;
            message?: ChatMessage;
            execution?: ExecutionRecord;
            results?: { ok: boolean; message: string; detail?: string }[];
            widgets?: WidgetRecord[];
          };
        } catch {
          continue;
        }
        if (typeof ev === "object" && ev && "type" in ev) {
          const e = ev as {
            type: string;
            text?: string;
            detail?: string;
            message?: ChatMessage;
            execution?: ExecutionRecord;
            results?: { ok: boolean; message: string; detail?: string }[];
            widgets?: WidgetRecord[];
          };
          if (e.type === "delta" && typeof e.text === "string") {
            acc += e.text;
            handlers.onDelta(e.text, acc);
          } else if (e.type === "done" && e.message && e.execution && e.results) {
            sawDone = true;
            const done = ev as {
              type: string;
              message?: ChatMessage;
              execution?: ExecutionRecord;
              results?: { ok: boolean; message: string; detail?: string }[];
              widgets?: WidgetRecord[];
              spaceDeletedAfterTurn?: boolean;
              activeSkillIds?: string[];
              skillRoutingReasons?: string[];
            };
            handlers.onDone({
              message: done.message!,
              execution: done.execution!,
              results: done.results!,
              widgets: done.widgets,
              spaceDeletedAfterTurn: done.spaceDeletedAfterTurn,
              activeSkillIds: done.activeSkillIds,
              skillRoutingReasons: done.skillRoutingReasons,
            });
          } else if (e.type === "error") {
            handlers.onError(e.detail ?? "stream_error");
            return;
          }
        }
      }
    }
    if (!sawDone) handlers.onError("stream ended without done");
  },

  patchLayout: (spaceId: string, layout: LayoutState) =>
    req<{ layout: LayoutState }>(`/api/spaces/${spaceId}/layout`, {
      method: "PATCH",
      body: JSON.stringify(layout),
    }),

  listSnapshots: (spaceId: string) =>
    req<{ snapshots: SnapshotMeta[] }>(`/api/spaces/${spaceId}/snapshots`),

  createSnapshot: (spaceId: string, label?: string, reason?: string) =>
    req<{ snapshot: SnapshotMeta; bundle: SnapshotBundle }>(`/api/spaces/${spaceId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ label, reason }),
    }),

  restoreSnapshot: (spaceId: string, snapshotId: string) =>
    req<{
      restored: true;
      widgetCount: number;
      preRestoreSnapshotId?: string;
      widgets: WidgetRecord[];
    }>(`/api/spaces/${spaceId}/restore/${snapshotId}`, { method: "POST" }),

  listExecutions: (spaceId: string) =>
    req<{ executions: ExecutionRecord[] }>(`/api/spaces/${spaceId}/executions`),

  getBrowserSession: (spaceId: string) => req<{ session: BrowserSession }>(`/api/spaces/${spaceId}/browser`),

  navigateBrowser: (spaceId: string, url: string, mode?: "mock" | "fetch" | "visual") =>
    req<{
      session: BrowserSession;
      transcription: BrowserPageTranscription;
      result: { implemented: boolean; message: string };
    }>(`/api/spaces/${spaceId}/browser/navigate`, {
      method: "POST",
      body: JSON.stringify({ url, mode }),
    }),

  postBrowserAction: (
    spaceId: string,
    action:
      | { type: "click"; targetId: string }
      | { type: "type"; targetId: string; text: string }
      | { type: "scroll"; amount: number }
      | { type: "back" },
  ) =>
    req<{ session: BrowserSession; result: { implemented: boolean; message: string } }>(
      `/api/spaces/${spaceId}/browser/action`,
      { method: "POST", body: JSON.stringify(action) },
    ),

  transcribeBrowser: (spaceId: string, url: string, mode?: "mock" | "fetch") =>
    req<{ transcription: BrowserPageTranscription; session: BrowserSession }>(
      `/api/spaces/${spaceId}/browser/transcribe`,
      { method: "POST", body: JSON.stringify({ url, mode }) },
    ),

  patchWidget: (spaceId: string, widgetId: string, body: Record<string, unknown>) =>
    req<{ widget: WidgetRecord }>(`/api/spaces/${spaceId}/widgets/${widgetId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteWidget: (spaceId: string, widgetId: string) =>
    req<{ deleted: true }>(`/api/spaces/${spaceId}/widgets/${widgetId}`, { method: "DELETE" }),

  getWidgetLiveData: (spaceId: string, widgetId: string) =>
    req<WidgetLiveDataResponse>(`/api/spaces/${spaceId}/widgets/${widgetId}/live-data`),

  /** Same-origin URL for a PDF produced by `export.pdf` (`Content-Disposition` uses optional `filename`). */
  spaceExportPdfUrl: (spaceId: string, exportId: string, filename?: string) => {
    const base = `${API}/api/spaces/${spaceId}/exports/pdf/${exportId}`;
    if (!filename?.trim()) return base;
    return `${base}?filename=${encodeURIComponent(filename.trim())}`;
  },

  /** Same-origin URL for a PNG/WebP/JPEG saved from an OpenRouter image-model reply. */
  spaceExportImageUrl: (spaceId: string, exportId: string, filename?: string) => {
    const base = `${API}/api/spaces/${spaceId}/exports/image/${exportId}`;
    if (!filename?.trim()) return base;
    return `${base}?filename=${encodeURIComponent(filename.trim())}`;
  },

  listSpaceExports: (spaceId: string) =>
    req<{
      exports: Array<{
        exportId: string;
        filename: string | null;
        bytes: number;
        updatedAt: string;
        kind: "pdf" | "image";
      }>;
    }>(`/api/spaces/${spaceId}/exports`),

  recoverySummary: () =>
    req<{
      spaces: Array<{
        id: string;
        name: string;
        brokenWidgets: Array<{ id: string; file: string; error: string }>;
        snapshotCount: number;
        loadError?: string;
      }>;
    }>("/api/recovery/summary"),

  recoverySpaces: () => req<{ spaces: RecoverySummary[] }>("/api/recovery/spaces"),

  recoverySpaceDetail: (spaceId: string) => req<SpaceRecoveryDetail>(`/api/recovery/spaces/${spaceId}`),

  recoveryRepair: (spaceId: string) =>
    req<{ repaired: string[] }>(`/api/recovery/spaces/${spaceId}/repair`, { method: "POST" }),

  recoveryDisableWidget: (spaceId: string, widgetId: string) =>
    req<{ disabled: true }>(`/api/recovery/spaces/${spaceId}/widgets/${widgetId}/disable`, {
      method: "POST",
    }),

  getProfileLlm: () => req<ProfileLlmMasked>("/api/profile/llm"),

  putProfileLlm: (body: ProfileLlmPutBody) =>
    req<ProfileLlmMasked>("/api/profile/llm", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  postValidateOpenRouter: (body?: { apiKey?: string; providerBaseUrl?: string }) =>
    req<{ ok: true; modelCount: number }>("/api/profile/llm/openrouter/validate", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  listReferenceLibrary: () =>
    req<{
      entries: Array<{
        id: string;
        originalName: string;
        mime: string;
        size: number;
        ingestedAt: string;
        title?: string;
        tags: string[];
        caption?: string;
      }>;
    }>("/api/reference-library"),

  searchReferenceLibrary: (q: string, mode?: "keyword" | "hybrid") => {
    const qs = new URLSearchParams({ q });
    if (mode === "keyword") qs.set("mode", "keyword");
    return req<{
      hits: Array<{
        id: string;
        originalName: string;
        mime: string;
        size: number;
        ingestedAt: string;
        title?: string;
        tags: string[];
        caption?: string;
        score: number;
        snippet?: string;
      }>;
    }>(`/api/reference-library/search?${qs.toString()}`);
  },

  ingestReferenceLibrary: (formData: FormData) =>
    req<{
      entry: {
        id: string;
        originalName: string;
        mime: string;
        size: number;
        ingestedAt: string;
        title?: string;
        tags: string[];
        caption?: string;
      };
    }>("/api/reference-library/ingest", {
      method: "POST",
      body: formData,
    }),

  referenceLibraryFileUrl: (id: string) => `/api/reference-library/${encodeURIComponent(id)}/file`,

  reindexReferenceLibraryEmbeddings: () =>
    req<{ total: number; embedded: number; skipped: number }>("/api/reference-library/reindex-embeddings", {
      method: "POST",
    }),
};
