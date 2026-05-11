import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { HangmanPanelPayloadSchema, type HangmanPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const MAX_WRONG = 6;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Short AIRIS-themed dictionary; all uppercase A–Z. */
const WORDS: readonly string[] = [
  "AIRIS",
  "ADAPTER",
  "AGENT",
  "BEACON",
  "BRIGHT",
  "BROWSER",
  "CANVAS",
  "CAPSULE",
  "CODEBASE",
  "CRYSTAL",
  "DRIFT",
  "DYNAMIC",
  "ECHO",
  "FLIGHT",
  "FORGE",
  "GALAXY",
  "GLITCH",
  "HARBOR",
  "HARVEST",
  "INBOX",
  "INSIGHT",
  "JOURNEY",
  "JUMPER",
  "KERNEL",
  "KINETIC",
  "LAUNCH",
  "LATTICE",
  "MATRIX",
  "METRICS",
  "NETWORK",
  "NEXUS",
  "ORBIT",
  "OXYGEN",
  "PATTERN",
  "PIPELINE",
  "PRISM",
  "QUANTUM",
  "QUARTZ",
  "RHYTHM",
  "ROBOT",
  "SIGNAL",
  "SURFACE",
  "THREAD",
  "TUNNEL",
  "TURTLE",
  "UPTIME",
  "UTILITY",
  "VECTOR",
  "VOYAGE",
  "WIDGET",
  "WINDOW",
  "WORKFLOW",
  "ZEPHYR",
];

function pickWord(rng: () => number): string {
  return WORDS[Math.floor(rng() * WORDS.length)]!;
}

function wrongGuessCount(guessed: readonly string[], word: string): number {
  const w = word.toUpperCase();
  let n = 0;
  for (const c of new Set(guessed)) {
    if (!w.includes(c)) n++;
  }
  return n;
}

function isWon(guessed: readonly string[], word: string): boolean {
  const w = word.toUpperCase();
  return [...w].every((c) => guessed.includes(c));
}

function HangmanFigure({ wrong }: { wrong: number }) {
  const stroke = "rgb(45 212 191)";
  const gallow = "rgb(71 85 105)";
  return (
    <svg viewBox="0 0 120 140" className="h-36 w-full max-w-[11rem] sm:h-40" aria-hidden>
      <line x1="18" y1="128" x2="102" y2="128" stroke={gallow} strokeWidth="4" strokeLinecap="round" />
      <line x1="38" y1="128" x2="38" y2="24" stroke={gallow} strokeWidth="4" strokeLinecap="round" />
      <line x1="38" y1="24" x2="88" y2="24" stroke={gallow} strokeWidth="4" strokeLinecap="round" />
      <line x1="88" y1="24" x2="88" y2="40" stroke={gallow} strokeWidth="3" strokeLinecap="round" />
      {wrong >= 1 ? <circle cx="88" cy="52" r="11" fill="none" stroke={stroke} strokeWidth="3" /> : null}
      {wrong >= 2 ? <line x1="88" y1="63" x2="88" y2="92" stroke={stroke} strokeWidth="3" strokeLinecap="round" /> : null}
      {wrong >= 3 ? <line x1="88" y1="72" x2="68" y2="86" stroke={stroke} strokeWidth="3" strokeLinecap="round" /> : null}
      {wrong >= 4 ? <line x1="88" y1="72" x2="108" y2="86" stroke={stroke} strokeWidth="3" strokeLinecap="round" /> : null}
      {wrong >= 5 ? <line x1="88" y1="92" x2="74" y2="118" stroke={stroke} strokeWidth="3" strokeLinecap="round" /> : null}
      {wrong >= 6 ? <line x1="88" y1="92" x2="102" y2="118" stroke={stroke} strokeWidth="3" strokeLinecap="round" /> : null}
    </svg>
  );
}

export function HangmanPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => HangmanPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());

  const [word, setWord] = useState(() => pickWord(rngRef.current));
  const [guessed, setGuessed] = useState<string[]>([]);
  const [phase, setPhase] = useState<"playing" | "won" | "lost">("playing");

  const patchData = useCallback(
    (partial: Partial<HangmanPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const wrong = useMemo(() => wrongGuessCount(guessed, word), [guessed, word]);

  const newWord = useCallback(() => {
    setWord(pickWord(rngRef.current));
    setGuessed([]);
    setPhase("playing");
  }, []);

  useEffect(() => {
    newWord();
  }, [record.id, newWord]);

  const guess = useCallback(
    (letter: string) => {
      const L = letter.toUpperCase();
      if (phase !== "playing" || L.length !== 1 || L < "A" || L > "Z") return;
      setGuessed((prev) => {
        if (prev.includes(L)) return prev;
        const next = [...prev, L].sort();
        const w = wrongGuessCount(next, word);
        const won = isWon(next, word);
        const lost = w >= MAX_WRONG;
        if (won || lost) {
          queueMicrotask(() => {
            const p = payloadRef.current;
            if (won) {
              patchData({ gamesWon: p.gamesWon + 1 });
              setPhase("won");
            } else {
              patchData({ gamesLost: p.gamesLost + 1 });
              setPhase("lost");
            }
          });
        }
        return next;
      });
    },
    [phase, patchData, word],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      const k = e.key.toUpperCase();
      if (k.length === 1 && k >= "A" && k <= "Z") {
        e.preventDefault();
        guess(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guess, phase]);

  const displaySlots = [...word].map((c) => (guessed.includes(c) || phase === "lost" ? c : "·"));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span>
          Won: <span className="font-mono text-teal-200">{payload.gamesWon}</span>
        </span>
        <span>
          Lost: <span className="font-mono text-rose-200/80">{payload.gamesLost}</span>
        </span>
        <span>
          Wrong:{" "}
          <span className="font-mono text-slate-200">
            {wrong}/{MAX_WRONG}
          </span>
        </span>
      </div>

      {phase === "won" ? (
        <p className="text-[12px] font-medium text-teal-200">You got it — nice work.</p>
      ) : null}
      {phase === "lost" ? (
        <p className="text-[12px] text-rose-200/90">
          Out of guesses. The word was <span className="font-mono font-semibold text-slate-100">{word}</span>.
        </p>
      ) : null}
      {phase === "playing" ? (
        <p className="text-[12px] text-slate-400">Pick letters (keyboard or buttons). Six wrong guesses and it is game over.</p>
      ) : null}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
        <HangmanFigure wrong={wrong} />
        <div className="flex flex-col items-center gap-2">
          <p
            className={`font-mono text-lg font-semibold tracking-[0.35em] sm:text-xl ${
              phase === "lost" ? "text-rose-100" : "text-slate-100"
            }`}
            aria-live="polite"
          >
            {displaySlots.join(" ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {LETTERS.split("").map((ch) => {
          const used = guessed.includes(ch);
          return (
            <button
              key={ch}
              type="button"
              disabled={used || phase !== "playing"}
              onClick={() => guess(ch)}
              className={`h-8 min-w-[1.75rem] rounded-md border text-[12px] font-semibold ${
                used
                  ? "border-slate-700 bg-slate-900/60 text-slate-500"
                  : "border-slate-600 bg-slate-800/80 text-slate-100 hover:border-teal-600/50 hover:bg-slate-800"
              } disabled:cursor-default`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={newWord}
        >
          {phase === "playing" ? "New word (forfeit)" : "Next word"}
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #16: classic hangman. Agent kind <code className="text-slate-400">hangman-panel</code>.
      </p>
    </div>
  );
}
