import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { MemoryMatchPanelPayloadSchema, type MemoryMatchPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const SYMBOLS = ["🌟", "🎵", "🍎", "🎯", "🌙", "⚡", "🔷", "🍀"] as const;

type Card = {
  pairId: number;
  faceUp: boolean;
  matched: boolean;
};

function shufflePairIds(rng: () => number): number[] {
  const ids = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [i, i]);
  for (let k = ids.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [ids[k], ids[j]] = [ids[j], ids[k]];
  }
  return ids;
}

function freshDeck(rng: () => number): Card[] {
  return shufflePairIds(rng).map((pairId) => ({
    pairId,
    faceUp: false,
    matched: false,
  }));
}

export function MemoryMatchPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => MemoryMatchPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());
  const firstPickRef = useRef<number | null>(null);
  const flipBackTimerRef = useRef<number | undefined>(undefined);
  const movesRef = useRef(0);
  const [, bumpMoves] = useReducer((n: number) => n + 1, 0);

  const [cards, setCards] = useState<Card[]>(() => freshDeck(rngRef.current));
  const [peekLocked, setPeekLocked] = useState(false);
  const [wonBanner, setWonBanner] = useState(false);

  const patchData = useCallback(
    (partial: Partial<MemoryMatchPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const clearFlipTimer = useCallback(() => {
    if (flipBackTimerRef.current != null) {
      window.clearTimeout(flipBackTimerRef.current);
      flipBackTimerRef.current = undefined;
    }
  }, []);

  const deal = useCallback(() => {
    clearFlipTimer();
    firstPickRef.current = null;
    movesRef.current = 0;
    bumpMoves();
    setPeekLocked(false);
    setWonBanner(false);
    setCards(freshDeck(rngRef.current));
  }, [clearFlipTimer]);

  useEffect(() => {
    deal();
  }, [record.id, deal]);

  useEffect(
    () => () => {
      clearFlipTimer();
    },
    [clearFlipTimer],
  );

  const onWin = useCallback(
    (moveCount: number) => {
      setWonBanner(true);
      const p = payloadRef.current;
      patchData({
        gamesWon: p.gamesWon + 1,
        bestMoves: p.bestMoves === 0 ? moveCount : Math.min(p.bestMoves, moveCount),
      });
    },
    [patchData],
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (peekLocked) return;

      setCards((prev) => {
        const cur = prev[index];
        if (cur.matched || cur.faceUp) return prev;

        const fp = firstPickRef.current;
        if (fp === null) {
          firstPickRef.current = index;
          const next = [...prev];
          next[index] = { ...next[index], faceUp: true };
          return next;
        }

        if (fp === index) return prev;

        firstPickRef.current = null;
        const next = [...prev];
        next[index] = { ...next[index], faceUp: true };

        const moveCount = movesRef.current + 1;
        movesRef.current = moveCount;
        queueMicrotask(() => bumpMoves());

        const match = next[fp].pairId === next[index].pairId;
        if (match) {
          const merged = [...next];
          merged[fp] = { ...merged[fp], matched: true };
          merged[index] = { ...merged[index], matched: true };
          if (merged.every((c) => c.matched)) {
            queueMicrotask(() => onWin(moveCount));
          }
          return merged;
        }

        queueMicrotask(() => {
          clearFlipTimer();
          setPeekLocked(true);
          flipBackTimerRef.current = window.setTimeout(() => {
            flipBackTimerRef.current = undefined;
            setCards((p2) => {
              const out = [...p2];
              if (!out[fp].matched) out[fp] = { ...out[fp], faceUp: false };
              if (!out[index].matched) out[index] = { ...out[index], faceUp: false };
              return out;
            });
            setPeekLocked(false);
          }, 720);
        });

        return next;
      });
    },
    [clearFlipTimer, onWin, peekLocked],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span>
          Games won: <span className="font-mono text-teal-200">{payload.gamesWon}</span>
        </span>
        <span>
          Best moves:{" "}
          <span className="font-mono text-amber-200/90">{payload.bestMoves === 0 ? "—" : payload.bestMoves}</span>
        </span>
        <span>
          This round: <span className="font-mono text-slate-200">{movesRef.current}</span>
        </span>
      </div>

      {wonBanner ? (
        <p className="text-[12px] font-medium text-teal-200">
          Cleared in {movesRef.current} moves — shuffle again?
        </p>
      ) : (
        <p className="text-[12px] text-slate-400">Find all 8 pairs. One move = two cards flipped.</p>
      )}

      <div className="mx-auto grid w-full max-w-[20rem] grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={peekLocked || c.matched}
            onClick={() => onCardClick(i)}
            className={`flex aspect-square min-h-[2.75rem] items-center justify-center rounded-lg border text-2xl leading-none transition-colors sm:min-h-[3.25rem] sm:text-3xl ${
              c.matched
                ? "border-teal-700/50 bg-teal-950/40"
                : c.faceUp
                  ? "border-slate-500 bg-slate-800/90"
                  : "border-slate-600 bg-slate-900/90 hover:border-teal-600/50 hover:bg-slate-800"
            } disabled:cursor-default disabled:opacity-80`}
            aria-label={c.faceUp || c.matched ? `Card ${SYMBOLS[c.pairId]}` : "Hidden card"}
          >
            {c.faceUp || c.matched ? SYMBOLS[c.pairId] : <span className="text-lg text-slate-500 sm:text-xl">?</span>}
          </button>
        ))}
      </div>

      <div>
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={deal}
        >
          New deal
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #13: 4×4 grid, eight emoji pairs. Agent kind <code className="text-slate-400">memory-match-panel</code>.
      </p>
    </div>
  );
}
