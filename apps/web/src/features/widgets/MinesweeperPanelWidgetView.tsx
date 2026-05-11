import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { WidgetRecord } from "@airis/shared";
import { MinesweeperPanelPayloadSchema, type MinesweeperPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const ROWS = 9;
const COLS = 9;
const MINES = 10;

type Cell = {
  isMine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
};

function emptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      adj: 0,
      revealed: false,
      flagged: false,
    })),
  );
}

function cloneGrid(g: Cell[][]): Cell[][] {
  return g.map((row) => row.map((c) => ({ ...c })));
}

function forEachNeighbor(r: number, c: number, fn: (nr: number, nc: number) => void): void {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) fn(nr, nc);
    }
  }
}

function placeMines(grid: Cell[][], safeR: number, safeC: number, rng: () => number): void {
  const forbidden = new Set<string>();
  forEachNeighbor(safeR, safeC, (nr, nc) => forbidden.add(`${nr},${nc}`));
  forbidden.add(`${safeR},${safeC}`);

  const candidates: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!forbidden.has(`${r},${c}`)) candidates.push([r, c]);
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = candidates[i]!;
    const b = candidates[j]!;
    candidates[i] = b;
    candidates[j] = a;
  }

  for (let m = 0; m < MINES && m < candidates.length; m++) {
    const [r, c] = candidates[m]!;
    grid[r][c].isMine = true;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) {
        grid[r][c].adj = 0;
        continue;
      }
      let n = 0;
      forEachNeighbor(r, c, (nr, nc) => {
        if (grid[nr][nc].isMine) n++;
      });
      grid[r][c].adj = n;
    }
  }
}

function floodReveal(grid: Cell[][], sr: number, sc: number): void {
  const stack: [number, number][] = [[sr, sc]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    const cell = grid[r][c];
    if (cell.flagged || cell.isMine) continue;
    if (cell.revealed) continue;
    cell.revealed = true;
    if (cell.adj === 0) {
      forEachNeighbor(r, c, (nr, nc) => {
        stack.push([nr, nc]);
      });
    }
  }
}

function countFlags(grid: Cell[][]): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].flagged) n++;
    }
  }
  return n;
}

function isWin(grid: Cell[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell.isMine && !cell.revealed) return false;
    }
  }
  return true;
}

function revealAllMines(grid: Cell[][]): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) grid[r][c].revealed = true;
    }
  }
}

const DIGIT_CLASS: Record<number, string> = {
  1: "text-sky-400",
  2: "text-emerald-400",
  3: "text-rose-400",
  4: "text-violet-400",
  5: "text-amber-700",
  6: "text-cyan-400",
  7: "text-slate-200",
  8: "text-slate-400",
};

export function MinesweeperPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => MinesweeperPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());

  const [grid, setGrid] = useState<Cell[][]>(() => emptyGrid());
  const [minesPlaced, setMinesPlaced] = useState(false);
  const [phase, setPhase] = useState<"playing" | "won" | "lost">("playing");
  const [flagMode, setFlagMode] = useState(false);

  const patchData = useCallback(
    (partial: Partial<MinesweeperPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const newGame = useCallback(() => {
    setGrid(emptyGrid());
    setMinesPlaced(false);
    setPhase("playing");
    setFlagMode(false);
  }, []);

  useEffect(() => {
    newGame();
  }, [record.id, newGame]);

  const onCellPrimary = useCallback(
    (r: number, c: number) => {
      if (phase !== "playing") return;
      const next = cloneGrid(grid);
      const cell = next[r][c];

      if (flagMode) {
        if (!cell.revealed) {
          cell.flagged = !cell.flagged;
          setGrid(next);
        }
        return;
      }

      if (cell.flagged || cell.revealed) return;

      if (!minesPlaced) {
        placeMines(next, r, c, rngRef.current);
        setMinesPlaced(true);
      }

      if (next[r][c].isMine) {
        revealAllMines(next);
        setGrid(next);
        setPhase("lost");
        const p = payloadRef.current;
        patchData({ gamesLost: p.gamesLost + 1 });
        return;
      }

      floodReveal(next, r, c);
      setGrid(next);

      if (isWin(next)) {
        setPhase("won");
        const p = payloadRef.current;
        patchData({ gamesWon: p.gamesWon + 1 });
      }
    },
    [grid, minesPlaced, phase, flagMode, patchData],
  );

  const onCellContext = useCallback(
    (e: MouseEvent, r: number, c: number) => {
      e.preventDefault();
      if (phase !== "playing" || flagMode) return;
      const next = cloneGrid(grid);
      const cell = next[r][c];
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      setGrid(next);
    },
    [grid, phase, flagMode],
  );

  const flags = useMemo(() => countFlags(grid), [grid]);
  const remaining = MINES - flags;

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
          Mines left: <span className="font-mono text-slate-200">{remaining}</span>
        </span>
      </div>

      {phase === "won" ? <p className="text-[12px] font-medium text-teal-200">Cleared — all safe squares open.</p> : null}
      {phase === "lost" ? <p className="text-[12px] font-medium text-rose-200/90">Hit a mine.</p> : null}
      {phase === "playing" ? (
        <p className="text-[12px] text-slate-400">
          9×9 beginner (10 mines). Click to open; right-click to flag; or toggle Flag mode for touch.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFlagMode((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
            flagMode
              ? "border-amber-500/80 bg-amber-950/60 text-amber-100"
              : "border-slate-600 bg-slate-800/80 text-slate-200 hover:border-slate-500"
          }`}
          aria-pressed={flagMode}
        >
          {flagMode ? "Flag mode on" : "Flag mode off"}
        </button>
        <button
          type="button"
          onClick={newGame}
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-3 py-1.5 text-[11px] font-semibold text-teal-100 hover:border-teal-500"
        >
          New game
        </button>
      </div>

      <div
        className="mx-auto inline-block rounded-xl border border-slate-700 bg-slate-900/80 p-1.5"
        style={{ touchAction: "manipulation" }}
      >
        <div className="grid grid-cols-9 gap-0.5">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const showMine = cell.revealed && cell.isMine;
              const showNum = cell.revealed && !cell.isMine && cell.adj > 0;
              const showEmpty = cell.revealed && !cell.isMine && cell.adj === 0;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={phase !== "playing"}
                  onClick={() => onCellPrimary(r, c)}
                  onContextMenu={(e) => onCellContext(e, r, c)}
                  className={`flex h-7 w-7 items-center justify-center rounded-sm border text-[11px] font-bold leading-none sm:h-8 sm:w-8 sm:text-xs ${
                    cell.revealed
                      ? showMine
                        ? "border-rose-700 bg-rose-950/80 text-rose-200"
                        : "border-slate-600 bg-slate-800/90"
                      : "border-slate-600 bg-slate-700/90 text-slate-200 hover:border-teal-600/40"
                  } disabled:cursor-default disabled:opacity-90`}
                  aria-label={
                    cell.flagged && !cell.revealed
                      ? "Flagged cell"
                      : cell.revealed
                        ? showMine
                          ? "Mine"
                          : `Revealed ${cell.adj || "empty"}`
                        : "Hidden cell"
                  }
                >
                  {cell.flagged && !cell.revealed ? (
                    <span className="text-amber-300" aria-hidden>
                      🚩
                    </span>
                  ) : showMine ? (
                    <span aria-hidden>💣</span>
                  ) : showNum ? (
                    <span className={DIGIT_CLASS[cell.adj] ?? "text-slate-300"}>{cell.adj}</span>
                  ) : showEmpty ? (
                    <span className="text-transparent">.</span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #19: beginner minesweeper. Agent kind <code className="text-slate-400">minesweeper-panel</code>.
      </p>
    </div>
  );
}
