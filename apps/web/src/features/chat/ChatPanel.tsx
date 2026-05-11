import { useRef, useState } from "react";
import { ChatAssistantBubble, ChatComposer, ChatUserBubble } from "../../components/chat";
import { useSessionStore } from "../../stores/session-store";

export type ChatPanelProps = {
  /** Drawer / embedded: drop outer chrome borders for glass shell. */
  embedded?: boolean;
};

export function ChatPanel(props: ChatPanelProps = {}) {
  const { embedded = false } = props;
  const chat = useSessionStore((s) => s.chat);
  const sendMessage = useSessionStore((s) => s.sendMessage);
  const runStatus = useSessionStore((s) => s.runStatus);
  const executions = useSessionStore((s) => s.executions);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const disabled = runStatus === "running";

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${embedded ? "border-0 bg-transparent" : "border-l border-slate-800 bg-slate-950/60"}`}
    >
      {!embedded && (
        <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Chat
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {chat.map((m) =>
          m.role === "user" ? (
            <ChatUserBubble key={m.id} message={m} />
          ) : (
            <ChatAssistantBubble key={m.id} message={m} />
          ),
        )}
        <div ref={endRef} />
      </div>
      <details className="group max-h-40 shrink-0 overflow-hidden border-t border-slate-800/90 bg-slate-950/80 [&_summary]:cursor-pointer">
        <summary className="list-none px-3 py-2 text-[10px] font-medium text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="mr-1 inline-block text-slate-600 transition-transform group-open:rotate-90">▸</span>
          Execution log
          <span className="ml-1.5 font-normal text-slate-600">({executions.length})</span>
        </summary>
        <ul className="max-h-28 space-y-1.5 overflow-y-auto px-3 pb-2 text-[11px] text-slate-500">
          {executions.slice(0, 12).map((e) => (
            <li key={e.id} className="leading-snug">
              <span className="text-slate-400">{e.createdAt.slice(11, 19)}</span>
              <span
                className={`ml-1 font-medium ${
                  e.status === "applied"
                    ? "text-emerald-400/90"
                    : e.status === "rejected"
                      ? "text-amber-400/90"
                      : e.status === "failed"
                        ? "text-red-400/90"
                        : "text-slate-400"
                }`}
              >
                {e.status}
              </span>
              {e.parsedBlock && "type" in e.parsedBlock ? (
                <span className="ml-1 text-slate-600">
                  · {e.parsedBlock.type}
                  {"widgetKind" in e.parsedBlock && e.parsedBlock.widgetKind
                    ? ` · ${e.parsedBlock.widgetKind}`
                    : ""}
                </span>
              ) : null}
              {e.createdWidgetIds && e.createdWidgetIds.length > 0 ? (
                <span className="ml-1 text-emerald-400/80">· {e.createdWidgetIds.length} widgets</span>
              ) : null}
              {e.browserDispatch ? (
                <span className="mt-0.5 block text-slate-500">
                  Browser: {e.browserDispatch.implemented ? "ok · " : "logged · "}
                  {e.browserDispatch.message.slice(0, 120)}
                  {e.browserDispatch.message.length > 120 ? "…" : ""}
                </span>
              ) : null}
              {e.errorMessage ? (
                <span className="mt-0.5 block text-red-400/80"> {e.errorMessage.slice(0, 100)}</span>
              ) : null}
            </li>
          ))}
          {executions.length === 0 && <li className="text-slate-600">No runs yet</li>}
        </ul>
      </details>
      <ChatComposer
        value={text}
        onChange={setText}
        disabled={disabled}
        onSend={() => {
          void sendMessage(text.trim()).then(() => {
            setText("");
            endRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }}
      />
    </div>
  );
}
