import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { TicTacToePanelPayloadSchema, type TicTacToePanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** 0 empty, 1 human X, 2 AI O */
function lineWinner(board: readonly number[]): 1 | 2 | null {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v !== 0 && v === board[b] && v === board[c]) return v as 1 | 2;
  }
  return null;
}

function outcome(board: readonly number[]): "x" | "o" | "draw" | "play" {
  const w = lineWinner(board);
  if (w === 1) return "x";
  if (w === 2) return "o";
  if (board.every((c) => c !== 0)) return "draw";
  return "play";
}

/**
 * Minimax from AI (O) perspective: O maximizes, X minimizes.
 * Terminal: O win +10−depth, X win depth−10, draw 0.
 */
function minimax(board: number[], depth: number, aiToMove: boolean): number {
  const o = outcome(board);
  if (o === "o") return 10 - depth;
  if (o === "x") return depth - 10;
  if (o === "draw") return 0;

  if (aiToMove) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== 0) continue;
      const next = [...board];
      next[i] = 2;
      best = Math.max(best, minimax(next, depth + 1, false));
    }
    return best;
  }
  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== 0) continue;
    const next = [...board];
    next[i] = 1;
    best = Math.min(best, minimax(next, depth + 1, true));
  }
  return best;
}

/** Prefer center, then corners, then edges when scores tie. */
const AI_MOVE_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7] as const;

function pickAiMove(board: readonly number[]): number {
  let bestScore = -Infinity;
  let bestI = -1;
  for (const i of AI_MOVE_ORDER) {
    if (board[i] !== 0) continue;
    const next = [...board];
    next[i] = 2;
    const score = minimax(next, 0, false);
    if (score > bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  return bestI;
}

export function TicTacToePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => TicTacToePanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const [board, setBoard] = useState<number[]>(() => Array(9).fill(0));
  const [phase, setPhase] = useState<"idle" | "ai_thinking">("idle");
  const aiTimerRef = useRef<number | undefined>(undefined);

  const patchData = useCallback(
    (partial: Partial<TicTacToePanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const recordResult = useCallback(
    (result: "x" | "o" | "draw") => {
      const p = payloadRef.current;
      if (result === "x") patchData({ winsVsAi: p.winsVsAi + 1 });
      else if (result === "o") patchData({ lossesVsAi: p.lossesVsAi + 1 });
      else patchData({ drawsVsAi: p.drawsVsAi + 1 });
    },
    [patchData],
  );

  const resetBoard = useCallback(() => {
    if (aiTimerRef.current != null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = undefined;
    }
    setPhase("idle");
    setBoard(Array(9).fill(0));
  }, []);

  useEffect(() => {
    resetBoard();
  }, [record.id, resetBoard]);

  useEffect(
    () => () => {
      if (aiTimerRef.current != null) window.clearTimeout(aiTimerRef.current);
    },
    [],
  );

  const onCellClick = useCallback(
    (index: number) => {
      if (phase === "ai_thinking") return;
      if (board[index] !== 0) return;
      const cur = outcome(board);
      if (cur !== "play") return;

      const next = [...board];
      next[index] = 1;
      setBoard(next);
      const afterHuman = outcome(next);
      if (afterHuman !== "play") {
        recordResult(afterHuman);
        return;
      }

      setPhase("ai_thinking");
      aiTimerRef.current = window.setTimeout(() => {
        aiTimerRef.current = undefined;
        const move = pickAiMove(next);
        if (move < 0) {
          setPhase("idle");
          return;
        }
        const afterAi = [...next];
        afterAi[move] = 2;
        setBoard(afterAi);
        setPhase("idle");
        const fin = outcome(afterAi);
        if (fin !== "play") recordResult(fin);
      }, 200);
    },
    [board, phase, recordResult],
  );

  const status = outcome(board);
  const statusLabel =
    phase === "ai_thinking"
      ? "AI is thinking…"
      : status === "play"
        ? "Your turn (X) — tap a cell"
        : status === "x"
          ? "You win!"
          : status === "o"
            ? "AI wins"
            : "Draw";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span>
          Wins: <span className="font-mono text-teal-200">{payload.winsVsAi}</span>
        </span>
        <span>
          Losses: <span className="font-mono text-rose-200/90">{payload.lossesVsAi}</span>
        </span>
        <span>
          Draws: <span className="font-mono text-amber-200/90">{payload.drawsVsAi}</span>
        </span>
      </div>

      <p className="text-[12px] font-medium text-slate-200">{statusLabel}</p>

      <div className="mx-auto grid aspect-square w-full max-w-[18rem] grid-cols-3 gap-2 p-2">
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            disabled={cell !== 0 || status !== "play" || phase === "ai_thinking"}
            onClick={() => onCellClick(i)}
            className="flex aspect-square min-h-[3.25rem] items-center justify-center rounded-xl border border-slate-600/90 bg-slate-900/80 text-3xl font-bold text-slate-100 transition-colors hover:border-teal-500/60 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Cell ${i + 1}`}
          >
            {cell === 1 ? <span className="text-teal-300">✕</span> : null}
            {cell === 2 ? <span className="text-rose-300">○</span> : null}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={resetBoard}
        >
          New game
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #12: you are <strong className="text-slate-400">X</strong>, AI is <strong className="text-slate-400">O</strong> (minimax).
        Agent kind <code className="text-slate-400">tic-tac-toe-panel</code>.
      </p>
    </div>
  );
}
