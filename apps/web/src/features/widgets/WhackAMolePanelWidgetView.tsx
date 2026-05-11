import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { WhackAMolePanelPayloadSchema, type WhackAMolePanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const HOLE_COUNT = 9;
const ROUND_SEC = 30;
const SPAWN_MS = 720;

function randomIntInclusive(a: number, b: number, rng: () => number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

export function WhackAMolePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => WhackAMolePanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());
  const playingRef = useRef(false);
  const scoreRef = useRef(0);
  const upRef = useRef<boolean[]>(Array.from({ length: HOLE_COUNT }, () => false));

  const tickRef = useRef<number | undefined>(undefined);
  const spawnRef = useRef<number | undefined>(undefined);
  const hideTimersRef = useRef<(number | undefined)[]>(Array.from({ length: HOLE_COUNT }, () => undefined));

  const [up, setUp] = useState<boolean[]>(() => Array(HOLE_COUNT).fill(false));
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SEC);
  const [phase, setPhase] = useState<"idle" | "playing" | "ended">("idle");

  const patchData = useCallback(
    (partial: Partial<WhackAMolePanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const cleanupTimers = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = undefined;
    }
    if (spawnRef.current != null) {
      window.clearInterval(spawnRef.current);
      spawnRef.current = undefined;
    }
    hideTimersRef.current.forEach((t, i) => {
      if (t != null) window.clearTimeout(t);
      hideTimersRef.current[i] = undefined;
    });
  }, []);

  const endRound = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    cleanupTimers();
    setPhase("ended");
    const s = scoreRef.current;
    if (s > payloadRef.current.bestScore) patchData({ bestScore: s });
  }, [cleanupTimers, patchData]);

  const trySpawn = useCallback(() => {
    if (!playingRef.current) return;
    const cur = upRef.current;
    const free: number[] = [];
    for (let k = 0; k < HOLE_COUNT; k++) {
      if (!cur[k]) free.push(k);
    }
    if (free.length === 0) return;
    const pick = free[Math.floor(rngRef.current() * free.length)]!;
    const next = [...cur];
    next[pick] = true;
    upRef.current = next;
    setUp(next);
    const prevT = hideTimersRef.current[pick];
    if (prevT != null) window.clearTimeout(prevT);
    const hideMs = randomIntInclusive(880, 1280, rngRef.current);
    hideTimersRef.current[pick] = window.setTimeout(() => {
      hideTimersRef.current[pick] = undefined;
      if (!playingRef.current) return;
      const board = upRef.current;
      if (!board[pick]) return;
      const cleared = [...board];
      cleared[pick] = false;
      upRef.current = cleared;
      setUp(cleared);
    }, hideMs);
  }, []);

  const startRound = useCallback(() => {
    cleanupTimers();
    playingRef.current = true;
    scoreRef.current = 0;
    setScore(0);
    const fresh = Array(HOLE_COUNT).fill(false) as boolean[];
    upRef.current = fresh;
    setUp(fresh);
    setTimeLeft(ROUND_SEC);
    setPhase("playing");

    tickRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (tickRef.current != null) {
            window.clearInterval(tickRef.current);
            tickRef.current = undefined;
          }
          queueMicrotask(() => endRound());
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    spawnRef.current = window.setInterval(() => {
      trySpawn();
    }, SPAWN_MS);

    queueMicrotask(() => trySpawn());
  }, [cleanupTimers, endRound, trySpawn]);

  const whack = useCallback((i: number) => {
    if (!playingRef.current) return;
    const cur = upRef.current;
    if (!cur[i]) return;
    const next = [...cur];
    next[i] = false;
    upRef.current = next;
    setUp(next);
    const t = hideTimersRef.current[i];
    if (t != null) window.clearTimeout(t);
    hideTimersRef.current[i] = undefined;
    setScore((s) => {
      const n = s + 1;
      scoreRef.current = n;
      return n;
    });
  }, []);

  useEffect(() => {
    cleanupTimers();
    playingRef.current = false;
    setPhase("idle");
    scoreRef.current = 0;
    setScore(0);
    const fresh = Array(HOLE_COUNT).fill(false) as boolean[];
    upRef.current = fresh;
    setUp(fresh);
    setTimeLeft(ROUND_SEC);
    return () => cleanupTimers();
  }, [record.id, cleanupTimers]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span>
          This round: <span className="font-mono text-teal-200">{score}</span>
        </span>
        <span>
          Best (30s): <span className="font-mono text-amber-200/90">{payload.bestScore}</span>
        </span>
        {phase === "playing" ? (
          <span>
            Time: <span className="font-mono text-slate-200">{timeLeft}s</span>
          </span>
        ) : null}
      </div>

      {phase === "idle" ? (
        <p className="text-[12px] text-slate-400">30 seconds — whack every mole you can. Misses cost nothing; only hits count.</p>
      ) : null}
      {phase === "ended" ? (
        <p className="text-[12px] text-slate-300">
          Round over — <span className="font-mono text-teal-200">{score}</span> whacks.
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-[16rem] rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 sm:max-w-[18rem]">
        <div className="grid grid-cols-3 gap-2">
          {up.map((isUp, i) => (
            <button
              key={i}
              type="button"
              disabled={phase !== "playing"}
              onClick={() => whack(i)}
              className={`relative flex aspect-square min-h-[3.25rem] select-none items-end justify-center overflow-hidden rounded-2xl border-2 transition-colors sm:min-h-[3.75rem] ${
                isUp
                  ? "border-amber-700/80 bg-gradient-to-b from-amber-950/90 to-slate-900 shadow-[inset_0_-6px_0_rgba(0,0,0,0.35)]"
                  : "border-slate-700 bg-slate-900/80 hover:border-slate-600"
              } disabled:cursor-default disabled:opacity-90`}
              aria-label={isUp ? "Whack mole" : "Empty hole"}
            >
              <span
                className={`mb-1 text-3xl leading-none transition-transform duration-150 sm:text-4xl ${
                  isUp ? "translate-y-0 scale-100" : "translate-y-[85%] scale-90 opacity-40"
                }`}
                aria-hidden
              >
                🦫
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {phase === "playing" ? (
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-[12px] font-medium text-slate-200 hover:border-rose-500/60 hover:text-rose-100"
            onClick={() => {
              playingRef.current = false;
              cleanupTimers();
              setPhase("ended");
              const s = scoreRef.current;
              if (s > payloadRef.current.bestScore) patchData({ bestScore: s });
            }}
          >
            End round early
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
            onClick={startRound}
          >
            {phase === "idle" ? "Start round" : "Play again"}
          </button>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #15: 3×3 whack-a-mole. Agent kind <code className="text-slate-400">whack-a-mole-panel</code>.
      </p>
    </div>
  );
}
