/**
 * Embedded AIRIS agent runtime (`airis-agent` widget and future callers).
 *
 * Deferred wiring:
 * - `spawnDepth` sent to `/api/agent/stream` is effectively always `0` from the UI today
 *   (`getSpawnDepth()` on `airis-agent` widgets reads payload `spawnDepth`, still default 0).
 *   When agent-spawning-agent is implemented, raise depth per nested spawn and pass it here.
 * - `getSpawnDepth()` on the hook options exists for that future path without changing the
 *   `send(userText, sendOpts?)` surface again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, WorkspaceSnapshot } from "@airis/shared";
import { ChatMessageSchema } from "@airis/shared";
import { streamAgent } from "../lib/agent-api";
import { useWidgetsStore } from "../stores/widgets-store";

/** Default snapshot until `getSnapshot` is supplied (`spaceId` must be a UUID). */
const DEFAULT_WORKSPACE_SNAPSHOT: WorkspaceSnapshot = {
  spaceId: "00000000-0000-4000-8000-000000000001",
  widgets: [],
};

export function normalizeStoredAgentMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const row of raw) {
    const p = ChatMessageSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export type UseAgentRuntimeOptions = {
  systemPrompt?: string;
  getSnapshot?: () => WorkspaceSnapshot;
  /** When set, `messages` / `agentStatus` / `lastError` are PATCHed onto the widget `data`. */
  persistWidgetId?: string;
  /** Server version + normalized messages — resync when idle (e.g. after reload). */
  remoteMessages?: ChatMessage[];
  remoteVersion?: number;
  getSpawnDepth?: () => number;
};

export type AgentRuntimeStatus = "idle" | "streaming" | "error";

/**
 * Embedded agent chat: local state, optional persistence to `WidgetRecord.data` for `airis-agent`.
 *
 * On error after partial assistant text: we **keep** the streamed assistant bubble and
 * append `\n\n[Error] …` so the failure is visible inline.
 */
export function useAgentRuntime(sessionId: string, options?: UseAgentRuntimeOptions) {
  const {
    getSnapshot = () => DEFAULT_WORKSPACE_SNAPSHOT,
    systemPrompt: _systemPrompt,
    persistWidgetId,
    remoteMessages,
    remoteVersion,
    getSpawnDepth = () => 0,
  } = options ?? {};
  void _systemPrompt;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    persistWidgetId && remoteMessages ? [...remoteMessages] : [],
  );
  const [status, setStatus] = useState<AgentRuntimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!persistWidgetId || remoteMessages == null || remoteVersion == null) return;
    if (abortRef.current !== null) return;
    if (status === "streaming") return;
    setMessages([...remoteMessages]);
    messagesRef.current = [...remoteMessages];
  }, [persistWidgetId, remoteMessages, remoteVersion, status]);

  const persistData = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!persistWidgetId) return;
      await useWidgetsStore.getState().patchWidgetRecord(persistWidgetId, { data: patch });
    },
    [persistWidgetId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
    setMessages((m) => {
      let merged = m;
      if (m.length > 0) {
        const last = m[m.length - 1];
        if (last.role === "assistant") {
          const endsStopped = last.content.trimEnd().endsWith("[Stopped]");
          if (!endsStopped) {
            const suffix = last.content.trim() ? `\n\n[Stopped]` : `[Stopped]`;
            merged = [...m];
            merged[m.length - 1] = { ...last, content: last.content + suffix };
          }
        }
      }
      messagesRef.current = merged;
      if (persistWidgetId) {
        void persistData({
          messages: merged,
          agentStatus: "idle",
          lastError: null,
        });
      }
      return merged;
    });
  }, [persistData, persistWidgetId]);

  const send = useCallback(
    async (userText: string, sendOpts?: { spawnDepth?: number }) => {
      const trimmed = userText.trim();
      if (!trimmed || abortRef.current !== null) return;

      const prior = messagesRef.current;
      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: now,
      };
      const assistantId = crypto.randomUUID();
      const assistantShell: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      const next = [...prior, userMsg, assistantShell];
      setMessages(next);
      messagesRef.current = next;

      setStatus("streaming");
      setError(null);

      const spawnDepth = sendOpts?.spawnDepth ?? getSpawnDepth();

      if (persistWidgetId) {
        void persistData({
          messages: next,
          agentStatus: "streaming",
          lastError: null,
        });
      }

      const ac = streamAgent(
        {
          sessionId,
          message: trimmed,
          workspaceSnapshot: getSnapshot(),
          spawnDepth,
          conversationHistory: prior,
        },
        {
          onDelta: (text) => {
            setMessages((m) => {
              const i = m.findIndex((x) => x.id === assistantId);
              if (i < 0) return m;
              const merged = [...m];
              const cur = merged[i]!;
              merged[i] = { ...cur, content: cur.content + text };
              messagesRef.current = merged;
              return merged;
            });
          },
          onDone: () => {
            abortRef.current = null;
            setStatus("idle");
            if (persistWidgetId) {
              const final = messagesRef.current;
              void persistData({
                messages: final,
                agentStatus: "idle",
                lastError: null,
              });
            }
          },
          onError: (detail) => {
            abortRef.current = null;
            setError(detail);
            setStatus("error");
            setMessages((m) => {
              const i = m.findIndex((x) => x.id === assistantId);
              if (i < 0) return m;
              const merged = [...m];
              const cur = merged[i]!;
              const suffix = cur.content ? `\n\n[Error] ${detail}` : `[Error] ${detail}`;
              merged[i] = { ...cur, content: cur.content + suffix };
              messagesRef.current = merged;
              if (persistWidgetId) {
                void persistData({
                  messages: merged,
                  agentStatus: "error",
                  lastError: detail,
                });
              }
              return merged;
            });
          },
        },
      );
      abortRef.current = ac;
    },
    [getSnapshot, getSpawnDepth, persistData, persistWidgetId, sessionId],
  );

  return { messages, send, status, error, cancel };
}
