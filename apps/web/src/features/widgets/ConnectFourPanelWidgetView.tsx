import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { ConnectFourPanelPayloadSchema, type ConnectFourPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const ROWS = 6;
const COLS = 7;
const HUMAN = 1;
const AI = 2;
const COL_PREF = [3, 2, 4, 1, 5, 0, 6] as const;

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function tryDrop(board: number[][], col: number, player: number): { board: number[][]; r: number; c: number } | null {
  let r = -1;
  for (let rr = ROWS - 1; rr >= 0; rr--) {
    if (board[rr][col] === 0) {
      r = rr;
      break;
    }
  }
  if (r < 0) return null;
  const next = board.map((row) => [...row]);
  next[r][col] = player;
  return { board: next, r, c: col };
}

function walk(board: number[][], r: number, c: number, dr: number, dc: number, p: number): number {
  let n = 0;
  let rr = r;
  let cc = c;
  while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === p) {
    n++;
    rr += dr;
    cc += dc;
  }
  return n;
}

function winsAt(board: number[][], r: number, c: number, p: number): boolean {
  if (board[r][c] !== p) return false;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const) {
    const a = walk(board, r, c, dr, dc, p);
    const b = walk(board, r, c, -dr, -dc, p);
    if (a + b - 1 >= 4) return true;
  }
  return false;
}

function validColumns(board: number[][]): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === 0) out.push(c);
  }
  return out;
}

function boardFull(board: number[][]): boolean {
  return validColumns(board).length === 0;
}

function pickWeightedColumn(valid: readonly number[], rng: () => number): number {
  const weights = valid.map((c) => 7 - Math.abs(3 - c));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = rng() * sum;
  for (let i = 0; i < valid.length; i++) {
    t -= weights[i]!;
    if (t <= 0) return valid[i]!;
  }
  return valid[valid.length - 1]!;
}

function pickAiColumn(board: number[][], rng: () => number): number | null {
  const valid = validColumns(board);
  if (valid.length === 0) return null;

  for (const col of valid) {
    const res = tryDrop(board, col, AI);
    if (res && winsAt(res.board, res.r, res.c, AI)) return col;
  }
  for (const col of valid) {
    const res = tryDrop(board, col, HUMAN);
    if (res && winsAt(res.board, res.r, res.c, HUMAN)) return col;
  }

  const ordered = COL_PREF.filter((c) => valid.includes(c));
  return pickWeightedColumn(ordered.length ? ordered : valid, rng);
}

export function ConnectFourPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => ConnectFourPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());
  const aiTimerRef = useRef<number | undefined>(undefined);

  const [board, setBoard] = useState<number[][]>(() => emptyBoard());
  const [phase, setPhase] = useState<"playing" | "ai_thinking" | "won" | "lost" | "draw">("playing");

  const patchData = useCallback(
    (partial: Partial<ConnectFourPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const recordOutcome = useCallback(
    (result: "win" | "lose" | "draw") => {
      const p = payloadRef.current;
      if (result === "win") patchData({ winsVsAi: p.winsVsAi + 1 });
      else if (result === "lose") patchData({ lossesVsAi: p.lossesVsAi + 1 });
      else patchData({ drawsVsAi: p.drawsVsAi + 1 });
    },
    [patchData],
  );

  const clearAiTimer = useCallback(() => {
    if (aiTimerRef.current != null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = undefined;
    }
  }, []);

  const resetGame = useCallback(() => {
    clearAiTimer();
    setBoard(emptyBoard());
    setPhase("playing");
  }, [clearAiTimer]);

  useEffect(() => {
    resetGame();
  }, [record.id, resetGame]);

  useEffect(() => () => clearAiTimer(), [clearAiTimer]);

  const runAiTurn = useCallback(
    (currentBoard: number[][]) => {
      const col = pickAiColumn(currentBoard, rngRef.current);
      if (col == null) {
        setPhase("draw");
        recordOutcome("draw");
        return;
      }
      const res = tryDrop(currentBoard, col, AI);
      if (!res) return;
      setBoard(res.board);
      if (winsAt(res.board, res.r, res.c, AI)) {
        setPhase("lost");
        recordOutcome("lose");
      } else if (boardFull(res.board)) {
        setPhase("draw");
        recordOutcome("draw");
      } else {
        setPhase("playing");
      }
    },
    [recordOutcome],
  );

  const dropHuman = useCallback(
    (col: number) => {
      if (phase !== "playing") return;
      if (col < 0 || col >= COLS) return;
      const res = tryDrop(board, col, HUMAN);
      if (!res) return;

      setBoard(res.board);

      if (winsAt(res.board, res.r, res.c, HUMAN)) {
        setPhase("won");
        recordOutcome("win");
        return;
      }
      if (boardFull(res.board)) {
        setPhase("draw");
        recordOutcome("draw");
        return;
      }

      setPhase("ai_thinking");
      clearAiTimer();
      aiTimerRef.current = window.setTimeout(() => {
        aiTimerRef.current = undefined;
        runAiTurn(res.board);
      }, 380);
    },
    [board, phase, clearAiTimer, recordOutcome, runAiTurn],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      const d = e.key;
      if (d >= "1" && d <= "7") {
        e.preventDefault();
        dropHuman(parseInt(d, 10) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dropHuman, phase]);

  const colPlayable = (c: number) => phase === "playing" && board[0][c] === 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span>
          You: <span className="font-mono text-teal-200">{payload.winsVsAi}</span>
        </span>
        <span>
          AI: <span className="font-mono text-rose-200/80">{payload.lossesVsAi}</span>
        </span>
        <span>
          Draws: <span className="font-mono text-slate-300">{payload.drawsVsAi}</span>
        </span>
      </div>

      {phase === "won" ? <p className="text-[12px] font-medium text-teal-200">Four in a row — you win.</p> : null}
      {phase === "lost" ? <p className="text-[12px] font-medium text-rose-200/90">AI connected four.</p> : null}
      {phase === "draw" ? <p className="text-[12px] text-slate-400">Board full — draw.</p> : null}
      {phase === "ai_thinking" ? (
        <p className="text-[12px] text-slate-500">AI is thinking…</p>
      ) : null}
      {phase === "playing" ? (
        <p className="text-[12px] text-slate-400">
          You are teal · AI is rose. Tap a column or press <span className="font-mono">1–7</span>.
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-[22rem]">
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              type="button"
              disabled={!colPlayable(c)}
              onClick={() => dropHuman(c)}
              className="rounded-md border border-slate-600 bg-slate-800/90 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Drop in column ${c + 1}`}
            >
              {c + 1}
            </button>
          ))}
        </div>

        <div
          className="rounded-xl border border-slate-700 bg-slate-900/80 p-2"
          style={{ touchAction: "manipulation" }}
        >
          <div className="flex flex-col gap-1">
            {board.map((row, r) => (
              <div key={r} className="grid grid-cols-7 gap-1">
                {row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    className="flex aspect-square max-h-10 min-h-0 items-center justify-center rounded-lg bg-slate-800/90 sm:max-h-11"
                  >
                    {cell === HUMAN ? (
                      <span className="h-[78%] w-[78%] rounded-full bg-teal-500 shadow-inner shadow-teal-900/50" />
                    ) : cell === AI ? (
                      <span className="h-[78%] w-[78%] rounded-full bg-rose-600 shadow-inner shadow-rose-900/50" />
                    ) : (
                      <span className="h-[78%] w-[78%] rounded-full bg-slate-950/80 ring-1 ring-slate-700/80" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={resetGame}
        >
          New game
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #18: 7×6 connect four vs heuristic AI. Agent kind <code className="text-slate-400">connect-four-panel</code>.
      </p>
    </div>
  );
}
