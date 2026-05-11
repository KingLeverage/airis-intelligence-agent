import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWidgetsStore } from "../../stores/widgets-store";
import { CLI_CATALOG_MENU_FAMILIES } from "../../features/widgets/cli-catalog-families";

type LibraryItem = {
  label: string;
  title: string;
  action?: () => void | Promise<void>;
};

function IconHamburger({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

const MENU_Z = 12_000;
const CLI_FLYOUT_W = 248;

/**
 * Space top bar: all “add widget” actions live behind one control so the rail stays compact.
 * Menu is portaled to `document.body` with fixed positioning so it is never clipped by the header or canvas.
 */
export function WidgetLibraryMenu() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"audio" | "games" | "general" | null>(null);
  const [cliFlyoutOpen, setCliFlyoutOpen] = useState(false);
  const [menuBounds, setMenuBounds] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cliFlyoutRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const addNoteWidget = useWidgetsStore((s) => s.addNoteWidget);
  const addSequencerPanelWidget = useWidgetsStore((s) => s.addSequencerPanelWidget);
  const addDrumMachinePanelWidget = useWidgetsStore((s) => s.addDrumMachinePanelWidget);
  const addPianoRollPanelWidget = useWidgetsStore((s) => s.addPianoRollPanelWidget);
  const addChordProgressionPanelWidget = useWidgetsStore((s) => s.addChordProgressionPanelWidget);
  const addLoopRecorderPanelWidget = useWidgetsStore((s) => s.addLoopRecorderPanelWidget);
  const addMetronomePanelWidget = useWidgetsStore((s) => s.addMetronomePanelWidget);
  const addSynthKeyboardPanelWidget = useWidgetsStore((s) => s.addSynthKeyboardPanelWidget);
  const addAudioVisualizerPanelWidget = useWidgetsStore((s) => s.addAudioVisualizerPanelWidget);
  const addMiniPlayerPanelWidget = useWidgetsStore((s) => s.addMiniPlayerPanelWidget);
  const addKaraokeLyricPanelWidget = useWidgetsStore((s) => s.addKaraokeLyricPanelWidget);
  const addGuitarTunerPanelWidget = useWidgetsStore((s) => s.addGuitarTunerPanelWidget);
  const addSnakeGamePanelWidget = useWidgetsStore((s) => s.addSnakeGamePanelWidget);
  const addTicTacToePanelWidget = useWidgetsStore((s) => s.addTicTacToePanelWidget);
  const addMemoryMatchPanelWidget = useWidgetsStore((s) => s.addMemoryMatchPanelWidget);
  const addPuzzle2048PanelWidget = useWidgetsStore((s) => s.addPuzzle2048PanelWidget);
  const addWhackAMolePanelWidget = useWidgetsStore((s) => s.addWhackAMolePanelWidget);
  const addHangmanPanelWidget = useWidgetsStore((s) => s.addHangmanPanelWidget);
  const addRockPaperScissorsPanelWidget = useWidgetsStore((s) => s.addRockPaperScissorsPanelWidget);
  const addConnectFourPanelWidget = useWidgetsStore((s) => s.addConnectFourPanelWidget);
  const addMinesweeperPanelWidget = useWidgetsStore((s) => s.addMinesweeperPanelWidget);
  const addReactionTimePanelWidget = useWidgetsStore((s) => s.addReactionTimePanelWidget);
  const addTypingSpeedPanelWidget = useWidgetsStore((s) => s.addTypingSpeedPanelWidget);
  const addPongPanelWidget = useWidgetsStore((s) => s.addPongPanelWidget);
  const addAirisAgentWidget = useWidgetsStore((s) => s.addAirisAgentWidget);
  const addCliCatalogWidget = useWidgetsStore((s) => s.addCliCatalogWidget);

  const generalNoteItem: LibraryItem = {
    label: "📝 Note",
    title: "Plain text note",
    action: addNoteWidget,
  };
  const generalAgentItem: LibraryItem = {
    label: "🤖 Spawn AIRIS Agent",
    title: "Embedded chat agent (max 5 per space)",
    action: addAirisAgentWidget,
  };

  const audioItems: LibraryItem[] = [
    { label: "🎚️ Step sequencer", title: "Interactive step sequencer", action: addSequencerPanelWidget },
    { label: "🥁 Drum machine", title: "2×16 kick/snare drum machine (Tone.js)", action: addDrumMachinePanelWidget },
    { label: "🎹 Piano roll", title: "C4–B4 piano roll × 16 steps (Tone.PolySynth)", action: addPianoRollPanelWidget },
    { label: "🎶 Chord progression", title: "Diatonic chord pads + MIDI export", action: addChordProgressionPanelWidget },
    { label: "🔁 Loop recorder", title: "Mic loop recorder (MediaRecorder + looping playback)", action: addLoopRecorderPanelWidget },
    { label: "⏱️ Metronome", title: "Metronome (Tone.Transport + beat pulse)", action: addMetronomePanelWidget },
    { label: "🎼 Synth keyboard", title: "PolySynth piano-style keyboard", action: addSynthKeyboardPanelWidget },
    { label: "📊 Audio visualizer", title: "Mic spectrum visualizer (canvas FFT)", action: addAudioVisualizerPanelWidget },
    { label: "▶️ Mini player", title: "HTML5 playlist player (seek, shuffle, repeat)", action: addMiniPlayerPanelWidget },
    { label: "🎤 Karaoke lyrics", title: "Timed lyrics + optional backing track", action: addKaraokeLyricPanelWidget },
    { label: "🎸 Guitar tuner", title: "Mic chromatic tuner vs open strings", action: addGuitarTunerPanelWidget },
  ];

  const gamesItems: LibraryItem[] = [
    { label: "🐍 Simple Snake Game", title: "Catalog #11 — grid snake (keyboard + pad)", action: addSnakeGamePanelWidget },
    {
      label: "⭕ Tic-Tac-Toe with AI",
      title: "Catalog #12 — you are X vs minimax O",
      action: addTicTacToePanelWidget,
    },
    {
      label: "🃏 Memory Match Card Game",
      title: "Catalog #13 — 4×4 emoji pairs",
      action: addMemoryMatchPanelWidget,
    },
    {
      label: "🔢 2048 Puzzle",
      title: "Catalog #14 — 4×4 merges, keyboard + pad",
      action: addPuzzle2048PanelWidget,
    },
    {
      label: "🦫 Whack-a-Mole",
      title: "Catalog #15 — 3×3, 30s rounds",
      action: addWhackAMolePanelWidget,
    },
    {
      label: "🪢 Hangman",
      title: "Catalog #16 — word guess, 6 strikes, keyboard",
      action: addHangmanPanelWidget,
    },
    {
      label: "✊ Rock Paper Scissors",
      title: "Catalog #17 — vs random AI, R / P / S keys",
      action: addRockPaperScissorsPanelWidget,
    },
    {
      label: "🔴 Connect Four",
      title: "Catalog #18 — 7×6 vs heuristic AI, keys 1–7",
      action: addConnectFourPanelWidget,
    },
    {
      label: "💣 Minesweeper",
      title: "Catalog #19 — 9×9 beginner, flag mode",
      action: addMinesweeperPanelWidget,
    },
    {
      label: "⚡ Reaction Time Tester",
      title: "Catalog #20 — wait for green, click latency",
      action: addReactionTimePanelWidget,
    },
    {
      label: "⌨️ Typing Speed Test",
      title: "Catalog #21 — passages, gross WPM",
      action: addTypingSpeedPanelWidget,
    },
    {
      label: "🏓 Pong",
      title: "Catalog #22 — W/S vs AI, first to five",
      action: addPongPanelWidget,
    },
  ];

  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBounds(null);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const update = () => setMenuBounds(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [open, activeCategory, cliFlyoutOpen]);

  useEffect(() => {
    if (!open) setCliFlyoutOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cliFlyoutOpen) {
        setCliFlyoutOpen(false);
        return;
      }
      setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (
        triggerRef.current?.contains(t) ||
        menuRef.current?.contains(t) ||
        cliFlyoutRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, cliFlyoutOpen]);

  const cliFlyoutLeft =
    menuBounds != null ? Math.max(8, menuBounds.left - CLI_FLYOUT_W - 8) : 0;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            {cliFlyoutOpen && menuBounds ? (
              <div
                ref={cliFlyoutRef}
                role="menu"
                aria-label="Choose a Printing Press CLI"
                className="max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl border border-[color:var(--airis-border-glass-strong)] bg-[color:rgba(8,16,26,0.98)] py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
                style={{
                  position: "fixed",
                  top: menuBounds.top,
                  left: cliFlyoutLeft,
                  width: CLI_FLYOUT_W,
                  zIndex: MENU_Z + 1,
                }}
              >
                <div className="border-b border-[color:var(--airis-border-glass)] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
                    CLI catalog — pick a tool
                  </span>
                  <p className="mt-1 text-[10px] leading-snug text-[color:var(--airis-text-tertiary)]">
                    Each opens a focused panel (presets + custom argv). Requires{" "}
                    <code className="text-[color:rgba(134,183,255,0.9)]">AIRIS_CLI_TOOLS=1</code>.
                  </p>
                </div>
                <ul className="py-1">
                  {CLI_CATALOG_MENU_FAMILIES.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        role="menuitem"
                        title={`Add CLI widget: ${f.label}`}
                        className="flex w-full px-3 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)]"
                        onClick={() => {
                          setCliFlyoutOpen(false);
                          setOpen(false);
                          void addCliCatalogWidget({ familyId: f.id });
                        }}
                      >
                        <span className="mr-2 shrink-0">{f.emoji}</span>
                        <span className="min-w-0">
                          <span className="font-medium">{f.label}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-[color:var(--airis-text-tertiary)]">
                            {f.program}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  <li className="mt-0.5 border-t border-[color:var(--airis-border-glass)] pt-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      title="All allowlisted CLIs in one widget"
                      className="flex w-full px-3 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)]"
                      onClick={() => {
                        setCliFlyoutOpen(false);
                        setOpen(false);
                        void addCliCatalogWidget();
                      }}
                    >
                      <span className="mr-2 shrink-0">📚</span>
                      <span>All CLIs in one widget…</span>
                    </button>
                  </li>
                </ul>
              </div>
            ) : null}
            <div
            ref={menuRef}
            role="menu"
            className="max-h-[min(70vh,22rem)] min-w-[13.5rem] overflow-y-auto rounded-xl border border-[color:var(--airis-border-glass-strong)] bg-[color:rgba(8,16,26,0.98)] py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md sm:min-w-[15rem]"
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right,
              zIndex: MENU_Z,
            }}
          >
            <div className="border-b border-[color:var(--airis-border-glass)] px-3 py-2">
              <span className="inline-flex rounded-md bg-[color:rgba(250,204,21,0.22)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:rgba(250,204,21,0.95)]">
                Pre-Set Widgets
              </span>
            </div>

            <ul className="py-1">
              <li
                onMouseEnter={() => setActiveCategory("audio")}
                onMouseLeave={() => setActiveCategory((x) => (x === "audio" ? null : x))}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)] hover:bg-[color:rgba(134,183,255,0.10)]"
                  onFocus={() => setActiveCategory("audio")}
                  onClick={() => setActiveCategory((x) => (x === "audio" ? null : "audio"))}
                  aria-expanded={activeCategory === "audio"}
                >
                  <span>🎵 Audio</span>
                  <span className="text-[12px] opacity-70">›</span>
                </button>

                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-150 ${
                    activeCategory === "audio" ? "max-h-[26rem] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ul className="py-1">
                    {audioItems.map((item) => (
                      <li key={item.label}>
                        <button
                          type="button"
                          role="menuitem"
                          title={item.title}
                          disabled={!item.action}
                          onClick={() => {
                            if (!item.action) return;
                            setOpen(false);
                            void item.action();
                          }}
                          className={`flex w-full px-5 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[color:var(--airis-text-primary)]`}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>

              <li
                onMouseEnter={() => setActiveCategory("games")}
                onMouseLeave={() => setActiveCategory((x) => (x === "games" ? null : x))}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)] hover:bg-[color:rgba(134,183,255,0.10)]"
                  onFocus={() => setActiveCategory("games")}
                  onClick={() => setActiveCategory((x) => (x === "games" ? null : "games"))}
                  aria-expanded={activeCategory === "games"}
                >
                  <span>🎮 Games & Play</span>
                  <span className="text-[12px] opacity-70">›</span>
                </button>

                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-150 ${
                    activeCategory === "games" ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ul className="py-1">
                    {gamesItems.map((item) => (
                      <li key={item.label}>
                        <button
                          type="button"
                          role="menuitem"
                          title={item.title}
                          disabled={!item.action}
                          onClick={() => {
                            if (!item.action) return;
                            setOpen(false);
                            void item.action();
                          }}
                          className={`flex w-full px-5 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[color:var(--airis-text-primary)]`}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>

              <li
                onMouseEnter={() => setActiveCategory("general")}
                onMouseLeave={() =>
                  setActiveCategory((x) => {
                    if (x === "general" && cliFlyoutOpen) return "general";
                    return x === "general" ? null : x;
                  })
                }
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--airis-text-tertiary)] hover:bg-[color:rgba(134,183,255,0.10)]"
                  onFocus={() => setActiveCategory("general")}
                  onClick={() => setActiveCategory((x) => (x === "general" ? null : "general"))}
                  aria-expanded={activeCategory === "general"}
                >
                  <span>📋 General</span>
                  <span className="text-[12px] opacity-70">›</span>
                </button>

                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-150 ${
                    activeCategory === "general" ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ul className="py-1">
                    <li key={generalNoteItem.label}>
                      <button
                        type="button"
                        role="menuitem"
                        title={generalNoteItem.title}
                        disabled={!generalNoteItem.action}
                        onClick={() => {
                          if (!generalNoteItem.action) return;
                          setOpen(false);
                          void generalNoteItem.action();
                        }}
                        className={`flex w-full px-5 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[color:var(--airis-text-primary)]`}
                      >
                        {generalNoteItem.label}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        aria-expanded={cliFlyoutOpen}
                        title="Open list of Printing Press CLIs (CoinGecko, Docker Hub, PyPI, Recipe Goat, …)"
                        className={`flex w-full items-center justify-between px-5 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)] ${cliFlyoutOpen ? "bg-[color:rgba(134,183,255,0.08)]" : ""}`}
                        onClick={() => {
                          setActiveCategory("general");
                          setCliFlyoutOpen((v) => !v);
                        }}
                      >
                        <span>🧰 CLI catalog</span>
                        <span className="text-[12px] opacity-70" aria-hidden>
                          ◀
                        </span>
                      </button>
                    </li>
                    <li key={generalAgentItem.label}>
                      <button
                        type="button"
                        role="menuitem"
                        title={generalAgentItem.title}
                        disabled={!generalAgentItem.action}
                        onClick={() => {
                          if (!generalAgentItem.action) return;
                          setOpen(false);
                          void generalAgentItem.action();
                        }}
                        className={`flex w-full px-5 py-2 text-left text-[11px] text-[color:var(--airis-text-primary)] transition-colors hover:bg-[color:rgba(134,183,255,0.12)] hover:text-[color:rgba(34,197,94,0.95)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[color:var(--airis-text-primary)]`}
                      >
                        {generalAgentItem.label}
                      </button>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
          </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className="relative inline-flex">
        <div
          role="button"
          tabIndex={0}
          title="Widget library — add panels to this space"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Open widget library"
          className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-[color:rgba(250,204,21,0.35)] bg-[color:rgba(250,204,21,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:rgba(250,204,21,0.95)] hover:border-[color:rgba(250,204,21,0.55)]"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
          }}
        >
          <IconHamburger className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Pre-Set Widgets</span>
        </div>
      </div>
      {menu}
    </>
  );
}
