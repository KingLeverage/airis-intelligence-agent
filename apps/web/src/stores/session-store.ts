import { create } from "zustand";
import type {
  AirisTheme,
  BrowserSession,
  ChatMessage,
  ExecutionRecord,
  ParsedExecutionBlock,
  SkillPromptMetrics,
} from "@airis/shared";
import { DEFAULT_LLM_MODEL_ID } from "@airis/shared";
import { api } from "../lib/api";
import { useBrowserStore } from "./browser-store";
import { useSpacesStore, HOME_CHAT_SPACE_LS_KEY } from "./spaces-store";
import { useWidgetsStore } from "./widgets-store";
import { useSkillsStore } from "./skills-store";
import { useAirisBubblesStore } from "./airis-bubbles-store";
import { useChromeStore } from "./chrome-store";
import { useBrowserTabsStore } from "./browser-tabs-store";
import { handleLocalAirisCommand } from "../lib/local-airis-commands";
import { isExternalBrowserTarget } from "../lib/external-browser-url";

function clipBubbleText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function executionBlocks(ex: ExecutionRecord): ParsedExecutionBlock[] {
  if (ex.parsedBlocks?.length) return ex.parsedBlocks;
  if (ex.parsedBlock) return [ex.parsedBlock];
  return [];
}

function lastBrowserNavigateUrl(blocks: ParsedExecutionBlock[]): string | undefined {
  let last: string | undefined;
  for (const b of blocks) {
    if (b.type !== "browser.navigate") continue;
    const p = b.payload as Record<string, unknown>;
    const u =
      (typeof p.url === "string" && p.url.trim()) ||
      (typeof b.url === "string" && b.url.trim()) ||
      undefined;
    if (u) last = u;
  }
  return last;
}

/**
 * After chat applies a browser.* execution, open the in-app browser.
 * If the model returned no execution block (`parsed`) but the user clearly asked to open Google / the browser,
 * still surface the panel so Home chat is not stuck with a dead UI.
 *
 * We intentionally do **not** call `window.open` here: search URLs should load inside AIRIS’s browser
 * panel (preview / optional Playwright). For a full system-browser tab, the user clicks **↗** in the panel.
 */
function surfaceBrowserPanelFromExecution(
  ex: ExecutionRecord,
  session: BrowserSession | undefined,
  userMessage?: string,
  assistantText?: string,
): void {
  const blocks = executionBlocks(ex);
  const chrome = useChromeStore.getState();

  if (ex.status === "applied" && blocks.some((b) => String(b.type).startsWith("browser."))) {
    const raw = lastBrowserNavigateUrl(blocks) ?? session?.currentUrl;
    const url = raw?.trim();
    if (url && isExternalBrowserTarget(url)) chrome.setPendingBrowserUrl(url);
    chrome.setOpenPanel("browser");
    chrome.setBrowserWindowMode("normal");
    return;
  }

  if (ex.status === "parsed") {
    const msg = userMessage?.trim() ?? "";
    const ast = assistantText?.trim() ?? "";
    const wantsOpenPanel =
      /\bopen\s+(the\s+)?browser\b/i.test(msg) ||
      /\b(show|launch|display)\s+(the\s+)?browser\b/i.test(msg);
    const wantsGoogle =
      /\b(navigate|go|open)\s+(to\s+)?google\b/i.test(msg) ||
      (/\b(navigate|open|visit|load)\b/i.test(ast) && /\bgoogle\b/i.test(ast));
    if (wantsOpenPanel || wantsGoogle) {
      const url = "https://www.google.com/";
      chrome.setPendingBrowserUrl(url);
      chrome.setOpenPanel("browser");
      chrome.setBrowserWindowMode("normal");
    }
  }
}

function humanizeExecutionTail(line: string): string {
  const l = line.trim();
  if (!l || l === "applied") return "";
  if (/^Workspace:/i.test(l)) {
    return `**Workspace** · ${l.replace(/^Workspace:\s*/i, "")}`;
  }
  return l.length > 260 ? `${l.slice(0, 257)}…` : l;
}

function appendBubblesFromChatResponse(chatRes: {
  assistantMessage: ChatMessage;
  execution: ExecutionRecord;
  results: { ok: boolean; message: string; detail?: string }[];
  result?: { implemented: boolean; message: string };
}): void {
  const push = useAirisBubblesStore.getState().pushBubble;
  const ex = chatRes.execution;
  const reply = chatRes.assistantMessage.content.trim();

  if (chatRes.result && !chatRes.result.implemented && chatRes.result.message) {
    if (reply) push({ kind: "reply", text: clipBubbleText(reply, 2000) });
    push({ kind: "warning", text: chatRes.result.message });
    return;
  }

  const firstBad = chatRes.results.find((r) => !r.ok);

  if (ex.status === "applied") {
    const r0 = chatRes.results[0];
    let line =
      chatRes.result?.message ??
      r0?.message ??
      (ex.parsedBlock && "type" in ex.parsedBlock
        ? `${ex.parsedBlock.type}${ex.parsedBlock.widgetKind ? ` · ${ex.parsedBlock.widgetKind}` : ""}`
        : "Applied.");
    if (ex.createdWidgetIds?.length) {
      line = `${line} · ${ex.createdWidgetIds.length} widgets`;
    }
    const tail = humanizeExecutionTail(line);
    const merged = Boolean(reply && tail && tail.length < 260);

    if (merged) {
      push({
        kind: "reply",
        text: clipBubbleText(`${reply}\n\n✨ ${tail}`, 2200),
      });
    } else {
      if (reply) push({ kind: "reply", text: clipBubbleText(reply, 2000) });
      if (tail) push({ kind: "success", text: clipBubbleText(tail, 480) });
      else if (!reply && line.trim() && line.trim() !== "applied") {
        push({ kind: "success", text: clipBubbleText(line, 480) });
      }
    }
  } else if (ex.status === "rejected") {
    if (reply) push({ kind: "reply", text: clipBubbleText(reply, 2000) });
    push({
      kind: "warning",
      text: ex.errorMessage ?? firstBad?.detail ?? firstBad?.message ?? "Rejected",
    });
  } else if (ex.status === "failed") {
    if (reply) push({ kind: "reply", text: clipBubbleText(reply, 2000) });
    push({ kind: "error", text: ex.errorMessage ?? firstBad?.detail ?? "Failed" });
  } else if (reply) {
    push({ kind: "reply", text: clipBubbleText(reply, 2000) });
  }

  const exportLinks: string[] = [];
  if (ex.pdfExports?.length) {
    for (const pe of ex.pdfExports) {
      const href = api.spaceExportPdfUrl(ex.spaceId, pe.exportId, pe.filename);
      exportLinks.push(`PDF · ${pe.filename}\n${href}`);
    }
  }
  if (ex.imageExports?.length) {
    for (const ie of ex.imageExports) {
      const href = api.spaceExportImageUrl(ex.spaceId, ie.exportId, ie.filename);
      exportLinks.push(`Image · ${ie.filename}\n${href}`);
    }
  }
  if (exportLinks.length > 0) {
    push({
      kind: "success",
      text: clipBubbleText(
        `${exportLinks.join("\n\n")}\n\n**Exports** (Panels row) lists every file. If that panel is open, the list just refreshed.`,
        900,
      ),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("airis-space-exports-changed", { detail: { spaceId: ex.spaceId } }),
      );
    }
  }
}

export type RunStatus = "idle" | "running";
export const AIRIS_THEMES: AirisTheme[] = [
  "iris-deepfield",
  "pearl-observatory",
  "aurora-lens",
  "solar-archive",
];

function normalizeTheme(theme: AirisTheme | undefined, fallback: AirisTheme): AirisTheme {
  if (theme === "dark") return "iris-deepfield";
  if (theme === "light") return "pearl-observatory";
  return theme ?? fallback;
}

interface SessionState {
  chat: ChatMessage[];
  executions: ExecutionRecord[];
  /** Skills whose instructions were injected on the last chat turn */
  lastChatActiveSkillIds: string[];
  lastSkillRoutingReasons: string[];
  lastSkillPromptMetrics: SkillPromptMetrics | null;
  modelId: string;
  theme: AirisTheme;
  runStatus: RunStatus;
  error: string | null;
  browserOpen: boolean;
  sendMessage: (text: string) => Promise<void>;
  setModelId: (id: string) => void;
  toggleTheme: () => void;
  setBrowserOpen: (v: boolean) => void;
  refreshExecutions: () => Promise<void>;
  refreshSpace: () => Promise<void>;
  /** Load widgets, skills, chat, and executions for a space without changing `activeSpaceId` (e.g. Home + Agent). */
  loadSessionForSpace: (spaceId: string) => Promise<void>;
  applyWorkspaceSettings: (settings: { theme?: AirisTheme; defaultModelId?: string }) => void;
  clearHomeSession: () => void;
  /** Clears persisted chat for the given workspace (defaults to active) and local bubbles. */
  clearWorkspaceChat: (spaceId?: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  chat: [],
  executions: [],
  lastChatActiveSkillIds: [],
  lastSkillRoutingReasons: [],
  lastSkillPromptMetrics: null,
  modelId: DEFAULT_LLM_MODEL_ID,
  theme: "iris-deepfield",
  runStatus: "idle",
  error: null,
  browserOpen: false,

  applyWorkspaceSettings: (settings) => {
    const incoming = settings.defaultModelId;
    let nextModel = get().modelId;
    if (incoming !== undefined && incoming !== null && String(incoming).trim() !== "") {
      const inc = String(incoming).trim();
      /** `mock` is retired from the product default; treat persisted mock as the OpenRouter default. */
      nextModel = inc === "mock" ? DEFAULT_LLM_MODEL_ID : inc;
    }
    set({
      theme: normalizeTheme(settings.theme, get().theme),
      modelId: nextModel,
      error: null,
    });
  },

  loadSessionForSpace: async (spaceId: string) => {
    set({ error: null });
    try {
      await useWidgetsStore.getState().load(spaceId);
      await useSkillsStore.getState().loadForSpace(spaceId);
      const chat = await api.getChat(spaceId);
      const exec = await api.listExecutions(spaceId);
      set({
        chat: chat.messages,
        executions: exec.executions,
        lastChatActiveSkillIds: [],
        lastSkillRoutingReasons: [],
        lastSkillPromptMetrics: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  refreshSpace: async () => {
    const id = useSpacesStore.getState().activeSpaceId;
    if (!id) return;
    await get().loadSessionForSpace(id);
  },

  sendMessage: async (text: string) => {
    const local = handleLocalAirisCommand(text);
    if (local.handled) {
      if (local.createWorkspace) {
        try {
          await useSpacesStore.getState().createSpace(local.createWorkspace.name);
          useAirisBubblesStore.getState().pushBubble({
            kind: "success",
            text: `Workspace “${local.createWorkspace.name}” created and opened.`,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          useAirisBubblesStore.getState().pushBubble({ kind: "error", text: msg });
        }
        return;
      }
      if (local.deleteWorkspace) {
        try {
          const spaces = useSpacesStore.getState();
          if (!spaces.spaces.length) {
            await spaces.loadSpaces();
          }
          const q = local.deleteWorkspace.query.trim();
          const list = useSpacesStore.getState().spaces;
          const lower = q.toLowerCase();
          const byId = list.find((s) => s.id.toLowerCase() === lower);
          const byExactName = list.find((s) => s.name.trim().toLowerCase() === lower);
          const byIncludes = list.find((s) => s.name.toLowerCase().includes(lower));
          const target = byId ?? byExactName ?? byIncludes;
          if (!target) {
            useAirisBubblesStore.getState().pushBubble({
              kind: "error",
              text: `No workspace matches “${q}”. Try the exact name or paste the space id.`,
            });
            return;
          }
          const ok =
            typeof window === "undefined"
              ? true
              : window.confirm(`Delete workspace “${target.name}”? This cannot be undone.`);
          if (!ok) {
            useAirisBubblesStore.getState().pushBubble({ kind: "success", text: "Cancelled." });
            return;
          }
          await useSpacesStore.getState().deleteSpace(target.id);
          useAirisBubblesStore.getState().pushBubble({
            kind: "success",
            text: `Workspace “${target.name}” was deleted.`,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          useAirisBubblesStore.getState().pushBubble({ kind: "error", text: msg });
        }
        return;
      }
      if (local.openBrowser) {
        const sid =
          useSpacesStore.getState().activeSpaceId ?? useSpacesStore.getState().getHomeChatSpaceIdIfValid();
        if (sid) useBrowserTabsStore.getState().ensureForSpace(sid);
        if (local.openBrowser.url) {
          useChromeStore.getState().setPendingBrowserUrl(local.openBrowser.url);
        }
        useChromeStore.getState().setOpenPanel("browser");
        useChromeStore.getState().setBrowserWindowMode("normal");
      }
      useAirisBubblesStore.getState().pushBubble({ kind: "success", text: local.message });
      return;
    }

    const spaces = useSpacesStore.getState();
    let id = spaces.activeSpaceId;
    if (!id) {
      id = await spaces.getOrCreateHomeChatSpaceId();
    }
    if (!id) return;
    useChromeStore.getState().setAirisExpanded(true);
    useAirisBubblesStore.getState().setThinking(true);
    set({ runStatus: "running", error: null });
    try {
      const chatRes = await api.postChat(id, text, get().modelId);
      const spaceGone = Boolean(chatRes.spaceDeletedAfterTurn);

      if (chatRes.browserSession) {
        useBrowserStore.getState().setSessionFromServer(chatRes.browserSession);
      }
      if (!spaceGone) {
        useBrowserTabsStore.getState().ensureForSpace(id);
        const cur = chatRes.browserSession?.currentUrl?.trim();
        if (cur && /^https?:\/\//i.test(cur) && isExternalBrowserTarget(cur)) {
          try {
            const host = new URL(cur).hostname.replace(/^www\./, "") || cur;
            useBrowserTabsStore.getState().setActiveTabUrl(cur, host);
          } catch {
            useBrowserTabsStore.getState().setActiveTabUrl(cur);
          }
        }
        surfaceBrowserPanelFromExecution(
          chatRes.execution,
          chatRes.browserSession,
          text.trim(),
          chatRes.assistantMessage.content,
        );
      }
      if (chatRes.result && !chatRes.result.implemented) {
        useBrowserStore.setState({ lastStubMessage: chatRes.result.message });
      } else if (chatRes.result?.implemented) {
        useBrowserStore.setState({ lastStubMessage: null });
      }
      useAirisBubblesStore.getState().setThinking(false);
      appendBubblesFromChatResponse(chatRes);

      if (!spaceGone) {
        const chat = await api.getChat(id);
        const exec = await api.listExecutions(id);
        set({
          chat: chat.messages,
          executions: exec.executions,
          runStatus: "idle",
          lastChatActiveSkillIds: chatRes.activeSkillIds ?? [],
          lastSkillRoutingReasons: chatRes.skillRoutingReasons ?? [],
          lastSkillPromptMetrics: chatRes.skillPromptMetrics ?? null,
        });
        useChromeStore.getState().setOrbState("success");
        await useWidgetsStore.getState().load(id);
      } else {
        set({
          chat: [],
          executions: [],
          runStatus: "idle",
          lastChatActiveSkillIds: chatRes.activeSkillIds ?? [],
          lastSkillRoutingReasons: chatRes.skillRoutingReasons ?? [],
          lastSkillPromptMetrics: chatRes.skillPromptMetrics ?? null,
        });
        useChromeStore.getState().setOrbState("success");
        await useSpacesStore.getState().exitToHome();
        try {
          if (localStorage.getItem(HOME_CHAT_SPACE_LS_KEY) === id) {
            localStorage.removeItem(HOME_CHAT_SPACE_LS_KEY);
          }
        } catch {
          /* ignore */
        }
      }

      const spaceListTouched =
        spaceGone ||
        (chatRes.execution.status === "applied" &&
          executionBlocks(chatRes.execution).some(
            (b) => b.type === "space.create" || b.type === "space.delete",
          ));
      if (spaceListTouched) {
        await useSpacesStore.getState().loadSpaces();
      }
    } catch (e) {
      useAirisBubblesStore.getState().setThinking(false);
      const msg = e instanceof Error ? e.message : String(e);
      useAirisBubblesStore.getState().pushBubble({ kind: "error", text: msg });
      set({
        runStatus: "idle",
        error: msg,
      });
      useChromeStore.getState().setOrbState("error");
    }
  },

  setModelId: (modelId: string) => {
    let id = modelId.trim();
    if (id === "mock") id = DEFAULT_LLM_MODEL_ID;
    set({ modelId: id });
  },

  toggleTheme: () =>
    set((s) => {
      const cur = normalizeTheme(s.theme, "iris-deepfield");
      const idx = AIRIS_THEMES.indexOf(cur);
      return { theme: AIRIS_THEMES[(idx + 1) % AIRIS_THEMES.length] };
    }),

  setBrowserOpen: (v: boolean) => set({ browserOpen: v }),

  refreshExecutions: async () => {
    const id = useSpacesStore.getState().activeSpaceId;
    if (!id) return;
    const exec = await api.listExecutions(id);
    set({ executions: exec.executions });
  },

  clearHomeSession: () =>
    set({
      chat: [],
      executions: [],
      lastChatActiveSkillIds: [],
      lastSkillRoutingReasons: [],
      lastSkillPromptMetrics: null,
      error: null,
    }),

  clearWorkspaceChat: async (spaceId?: string) => {
    let id: string | null = spaceId ?? useSpacesStore.getState().activeSpaceId;
    if (!id) id = useSpacesStore.getState().getHomeChatSpaceIdIfValid();
    if (!id) return;
    set({ error: null });
    try {
      await api.clearChat(id);
      useAirisBubblesStore.getState().clearBubbles();
      const exec = await api.listExecutions(id);
      set({
        chat: [],
        executions: exec.executions,
        lastChatActiveSkillIds: [],
        lastSkillRoutingReasons: [],
        lastSkillPromptMetrics: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
