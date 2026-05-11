import { useCallback, useMemo, useState } from "react";
import type { AirisAgentPayload, WidgetRecord, WorkspaceSnapshot } from "@airis/shared";
import { ChatAssistantBubble, ChatComposer, ChatUserBubble } from "../../components/chat";
import { normalizeStoredAgentMessages, useAgentRuntime } from "../../hooks/useAgentRuntime";
import { useWidgetsStore } from "../../stores/widgets-store";

function widgetSummary(w: WidgetRecord): string | undefined {
  const t = typeof w.title === "string" ? w.title.trim() : "";
  if (t) return t.slice(0, 200);
  return undefined;
}

function buildWorkspaceSnapshot(spaceId: string, widgets: WidgetRecord[]): WorkspaceSnapshot {
  return {
    spaceId,
    widgets: widgets.map((w) => ({
      id: w.id,
      kind: w.kind,
      title: w.title,
      summary: widgetSummary(w),
    })),
  };
}

export function AirisAgentWidgetView({ record }: { record: WidgetRecord }) {
  const [draft, setDraft] = useState("");
  const data = record.data as unknown as AirisAgentPayload;
  const sessionId = data.sessionId;

  const remoteMessages = useMemo(
    () => normalizeStoredAgentMessages(record.data.messages),
    [record.data.messages, record.id, record.version],
  );

  const getSnapshot = useCallback((): WorkspaceSnapshot => {
    const sid = useWidgetsStore.getState().spaceId;
    const list = useWidgetsStore.getState().widgets;
    if (!sid) {
      return {
        spaceId: "00000000-0000-4000-8000-000000000001",
        widgets: [],
      };
    }
    return buildWorkspaceSnapshot(sid, list);
  }, []);

  const getSpawnDepth = useCallback(() => {
    const d = record.data as unknown as AirisAgentPayload;
    const n = d.spawnDepth;
    return typeof n === "number" && Number.isInteger(n) ? Math.min(2, Math.max(0, n)) : 0;
  }, [record.data]);

  const { messages, send, status, error, cancel } = useAgentRuntime(sessionId, {
    systemPrompt: data.systemPrompt,
    getSnapshot,
    persistWidgetId: record.id,
    remoteMessages,
    remoteVersion: record.version,
    getSpawnDepth,
  });

  const dotClass =
    status === "streaming"
      ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : status === "error"
        ? "bg-red-500"
        : "bg-slate-500";

  const sidShort = sessionId.slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-slate-800/80 bg-slate-950/80">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/90 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`}
            title={status === "streaming" ? "Streaming" : status === "error" ? "Error" : "Idle"}
            aria-hidden
          />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            AIRIS · {sidShort}
          </span>
        </div>
        <button
          type="button"
          disabled={status !== "streaming"}
          className="widget-frame-action rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-40"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => cancel()}
        >
          Stop
        </button>
      </div>

      {error ? <p className="shrink-0 px-2 py-1 text-[10px] text-red-400/90">{error}</p> : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {messages.map((m) =>
          m.role === "user" ? (
            <ChatUserBubble key={m.id} message={m} />
          ) : (
            <ChatAssistantBubble key={m.id} message={m} />
          ),
        )}
      </div>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        disabled={status === "streaming"}
        placeholder="Message embedded agent…"
        onSend={() => {
          void send(draft);
          setDraft("");
        }}
      />
    </div>
  );
}
