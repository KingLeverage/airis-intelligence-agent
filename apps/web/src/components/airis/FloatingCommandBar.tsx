import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChromeStore, clampOrbToViewport } from "../../stores/chrome-store";
import { useSessionStore } from "../../stores/session-store";
import { useSpacesStore } from "../../stores/spaces-store";
import { useAirisBubblesStore } from "../../stores/airis-bubbles-store";
import { AirisOrb } from "./AirisOrb";
import { AirisBubbleStack } from "./AirisBubbleStack";
import { InlineResponseBubbles } from "../../features/airis/InlineResponseBubbles";
import { CommandBarOverflowMenu } from "./CommandBarOverflowMenu";
import { AirisLlmSettingsModal } from "./AirisLlmSettingsModal";

const DRAG_THRESHOLD = 10;

export function FloatingCommandBar() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId);
  const spaces = useSpacesStore((s) => s.spaces);
  const sendMessage = useSessionStore((s) => s.sendMessage);
  const runStatus = useSessionStore((s) => s.runStatus);
  const clearWorkspaceChat = useSessionStore((s) => s.clearWorkspaceChat);

  const airisExpanded = useChromeStore((s) => s.airisExpanded);
  const setAirisExpanded = useChromeStore((s) => s.setAirisExpanded);
  const orbAnchor = useChromeStore((s) => s.orbAnchor);
  const setOrbAnchor = useChromeStore((s) => s.setOrbAnchor);
  const isDragging = useChromeStore((s) => s.isDragging);
  const setDragging = useChromeStore((s) => s.setDragging);
  const setOrbState = useChromeStore((s) => s.setOrbState);
  const orbState = useChromeStore((s) => s.orbState);
  const commandBarFullMode = useChromeStore((s) => s.commandBarFullMode);
  const toggleCommandBarFullMode = useChromeStore((s) => s.toggleCommandBarFullMode);
  const commandBarCompactContext = useChromeStore((s) => s.commandBarCompactContext);
  const toggleCommandBarCompactContext = useChromeStore((s) => s.toggleCommandBarCompactContext);
  const setOpenPanel = useChromeStore((s) => s.setOpenPanel);

  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRootRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    anchorL: number;
    anchorB: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (airisExpanded) {
      setOrbState("expanded");
      queueMicrotask(() => inputRef.current?.focus());
    } else {
      setOrbState("collapsed");
    }
  }, [airisExpanded, setOrbState]);

  useEffect(() => {
    if (runStatus === "running") setOrbState("thinking");
    else if (orbState === "success" || orbState === "error") {
      const t = window.setTimeout(() => {
        setOrbState(airisExpanded ? "expanded" : "collapsed");
      }, 900);
      return () => window.clearTimeout(t);
    } else if (airisExpanded) setOrbState("expanded");
    else setOrbState("collapsed");
  }, [runStatus, airisExpanded, orbState, setOrbState]);

  useEffect(() => {
    if (!airisExpanded) return;
    const s = useChromeStore.getState();
    setOrbAnchor(s.orbAnchor.left, s.orbAnchor.bottom, activeSpaceId);
  }, [activeSpaceId, airisExpanded, setOrbAnchor]);

  useEffect(() => {
    if (!airisExpanded) return;
    const s = useChromeStore.getState();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const c = clampOrbToViewport(
      s.orbAnchor.left,
      s.orbAnchor.bottom,
      true,
      vw,
      vh,
      commandBarFullMode,
    );
    useChromeStore.setState({ orbAnchor: c });
  }, [commandBarFullMode, airisExpanded]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRootRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      const s = useChromeStore.getState();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const c = clampOrbToViewport(
        s.orbAnchor.left,
        s.orbAnchor.bottom,
        s.airisExpanded,
        vw,
        vh,
        s.commandBarFullMode,
      );
      useChromeStore.setState({ orbAnchor: c });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const barTowardRight = orbAnchor.left < vw / 2;

  const onOrbPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        anchorL: orbAnchor.left,
        anchorB: orbAnchor.bottom,
        moved: false,
      };
      setDragging(true);
      setOrbState("listening");
    },
    [orbAnchor.left, orbAnchor.bottom, setDragging, setOrbState],
  );

  const onOrbPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = d.startY - e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
      const vw0 = window.innerWidth;
      const vh0 = window.innerHeight;
      const nextL = d.anchorL + dx;
      const nextB = d.anchorB + dy;
      const fm = useChromeStore.getState().commandBarFullMode;
      const c = clampOrbToViewport(nextL, nextB, airisExpanded, vw0, vh0, fm);
      useChromeStore.setState({ orbAnchor: c });
    },
    [airisExpanded],
  );

  const onOrbPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
      setDragging(false);
      const { orbAnchor: o } = useChromeStore.getState();
      setOrbAnchor(o.left, o.bottom, activeSpaceId);

      if (!d.moved) {
        if (!airisExpanded) setAirisExpanded(true);
        else setAirisExpanded(false);
      } else {
        setOrbState(airisExpanded ? "expanded" : "collapsed");
      }
    },
    [activeSpaceId, airisExpanded, setAirisExpanded, setOrbAnchor, setOrbState, setDragging],
  );

  const canSend = Boolean(text.trim() && runStatus !== "running");

  const homeChatClearTarget = useMemo(
    () => useSpacesStore.getState().getHomeChatSpaceIdIfValid(),
    [spaces, activeSpaceId],
  );
  const canClearChat = Boolean(activeSpaceId || homeChatClearTarget);

  const onAttachFiles = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type.startsWith("text/") || f.name.endsWith(".md") || f.name.endsWith(".json")) {
      void f.text().then((t) => {
        setText((prev) => {
          const block = `[${f.name}]\n${t}`;
          return prev.trim() ? `${prev.trim()}\n\n${block}` : block;
        });
        queueMicrotask(() => inputRef.current?.focus());
      });
    } else {
      setText((prev) => {
        const line = `[Attached: ${f.name} — describe or paste key content for AIRIS]`;
        return prev.trim() ? `${prev.trim()}\n${line}` : line;
      });
      queueMicrotask(() => inputRef.current?.focus());
    }
  };

  const onClearChat = () => {
    const homeId = useSpacesStore.getState().getHomeChatSpaceIdIfValid();
    const target = activeSpaceId ?? homeId;
    if (!target) {
      useAirisBubblesStore.getState().clearBubbles();
      useSessionStore.getState().clearHomeSession();
      return;
    }
    if (!window.confirm("Clear all chat messages for this workspace? This cannot be undone.")) return;
    void clearWorkspaceChat(target);
  };

  const onOpenHistory = () => {
    setOpenPanel("agent");
  };

  const onModelSettings = () => {
    setLlmSettingsOpen(true);
  };

  const bubbleMaxH = commandBarFullMode ? "min(55vh,28rem)" : "min(40vh,18rem)";
  const pillMinW = commandBarFullMode ? "min(100vw-5rem,36rem)" : "min(100vw-6rem,28rem)";

  const cluster = (
    <div className={`flex items-end gap-3 ${barTowardRight ? "flex-row" : "flex-row-reverse"}`}>
      <button
        type="button"
        className="relative shrink-0 cursor-grab touch-none rounded-full border border-[color:rgba(45,212,191,0.45)] bg-[color:rgba(8,16,26,0.55)] p-0 shadow-[0_0_28px_rgba(45,212,191,0.22)] active:cursor-grabbing"
        aria-label={airisExpanded ? "Drag AIRIS or tap to collapse" : "Drag AIRIS or tap to open command"}
        onPointerDown={onOrbPointerDown}
        onPointerMove={onOrbPointerMove}
        onPointerUp={onOrbPointerUp}
        onPointerCancel={onOrbPointerUp}
        onPointerEnter={() => {
          if (!isDragging && runStatus !== "running") setOrbState("hover");
        }}
        onPointerLeave={() => {
          if (!isDragging && runStatus !== "running") setOrbState(airisExpanded ? "expanded" : "collapsed");
        }}
      >
        <AirisOrb
          className={
            airisExpanded
              ? "scale-100"
              : activeSpaceId
                ? "scale-95"
                : "!h-16 !w-16 scale-100 sm:!h-[4.25rem] sm:!w-[4.25rem]"
          }
        />
      </button>

      {airisExpanded && (
        <div
          className="relative flex min-w-0 flex-col gap-2"
          style={{ maxWidth: pillMinW, minWidth: "min(100%, 18rem)" }}
        >
          <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} aria-hidden />

          {/* Menu must NOT live inside overflow-hidden pill — it was clipped. Anchor covers pill + trigger for outside-click. */}
          <div ref={menuRootRef} className="relative w-full min-w-0 overflow-visible">
            <CommandBarOverflowMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              fullMode={commandBarFullMode}
              onToggleFullMode={toggleCommandBarFullMode}
              compactContext={commandBarCompactContext}
              onToggleCompactContext={toggleCommandBarCompactContext}
              onAttachClick={onAttachFiles}
              onClearChat={onClearChat}
              onOpenHistory={onOpenHistory}
              onModelSettings={onModelSettings}
              canClearChat={canClearChat}
            />
            <div
              className="airis-command-pill relative flex min-w-0 flex-col overflow-visible rounded-[9999px] border border-[color:rgba(45,212,191,0.35)] bg-[color:rgba(5,10,18,0.88)] shadow-[0_0_32px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
              style={{
                backgroundImage: `
                radial-gradient(ellipse 120% 80% at 20% 0%, rgba(34,211,238,0.08), transparent 50%),
                radial-gradient(ellipse 80% 60% at 80% 100%, rgba(99,102,241,0.06), transparent 45%)
              `,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[9999px] opacity-[0.35]"
                style={{
                  backgroundImage: `radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.9) 0, transparent 1px),
                  radial-gradient(1px 1px at 70% 60%, rgba(186,230,253,0.85) 0, transparent 1px),
                  radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.5) 0, transparent 1px),
                  radial-gradient(1px 1px at 90% 30%, rgba(165,243,252,0.7) 0, transparent 1px)`,
                  backgroundSize: "200% 200%",
                }}
              />
              <div className="relative flex min-h-[48px] items-end gap-1.5 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
                <textarea
                  ref={inputRef}
                  rows={commandBarCompactContext ? 1 : 2}
                  placeholder="Message AIRIS…"
                  disabled={runStatus === "running"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!canSend) return;
                      void sendMessage(text.trim()).then(() => setText(""));
                    }
                  }}
                  className="min-h-[40px] min-w-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-snug text-[color:var(--airis-text-primary)] outline-none placeholder:text-[color:rgba(148,163,184,0.85)] focus:ring-0"
                />
                <div
                  className="mb-2 hidden h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-[rgba(45,212,191,0.45)] to-transparent sm:block"
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => {
                    if (!canSend) return;
                    void sendMessage(text.trim()).then(() => setText(""));
                  }}
                  className="mb-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(45,212,191,0.5)] bg-gradient-to-b from-[rgba(45,212,191,0.25)] to-[rgba(34,211,238,0.12)] text-[#5eead4] shadow-[0_0_16px_rgba(45,212,191,0.35)] transition hover:border-[color:rgba(45,212,191,0.75)] hover:shadow-[0_0_22px_rgba(45,212,191,0.45)] disabled:opacity-35"
                  aria-label="Send message"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M12 18V6M8 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="relative z-10 mb-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(45,212,191,0.35)] bg-[color:rgba(15,23,42,0.6)] text-[#5eead4] shadow-[0_0_12px_rgba(45,212,191,0.15)] transition hover:border-[color:rgba(45,212,191,0.55)] hover:bg-[color:rgba(45,212,191,0.1)]"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Command options"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          {!commandBarCompactContext && (
            <p className="px-2 text-center text-[10px] text-[color:rgba(148,163,184,0.9)]">
              Chat from Home uses a saved thread · Open a workspace for canvas &amp;{" "}
              <span className="text-[#5eead4]/90">Agent</span> panel · Type{" "}
              <span className="font-mono text-[#5eead4]/90">open browser</span>,{" "}
              <span className="font-mono text-[#5eead4]/90">/browser https://…</span>, or{" "}
              <span className="font-mono text-[#5eead4]/90">create workspace Name</span>
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <AirisLlmSettingsModal open={llmSettingsOpen} onClose={() => setLlmSettingsOpen(false)} />
      <div
        className="airis-motion pointer-events-none fixed z-[130]"
        style={{
          left: orbAnchor.left,
          bottom: orbAnchor.bottom,
          transition: isDragging ? "none" : "left 0.2s var(--airis-ease-out), bottom 0.2s var(--airis-ease-out)",
        }}
      >
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          {airisExpanded && (
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: bubbleMaxH }}>
              <InlineResponseBubbles />
              <AirisBubbleStack />
            </div>
          )}
          {cluster}
        </div>
      </div>
    </>
  );
}
