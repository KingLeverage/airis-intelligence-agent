import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { Puzzle2048PanelPayloadSchema, type Puzzle2048PanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const SIZE = 4;
type Grid = number[][];

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function slideAndMergeLine(line: number[]): { next: number[]; gained: number } {
  const nums = line.filter((x) => x !== 0);
  const out: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const v = nums[i] * 2;
      out.push(v);
      gained += v;
      i += 2;
    } else {
      out.push(nums[i]);
      i += 1;
    }
  }
  while (out.length < SIZE) out.push(0);
  return { next: out, gained };
}

function moveLeft(grid: Grid): { grid: Grid; moved: boolean; gained: number } {
  let moved = false;
  let gained = 0;
  const next = grid.map((row) => {
    const { next: nr, gained: g } = slideAndMergeLine(row);
    gained += g;
    if (!row.every((v, idx) => v === nr[idx])) moved = true;
    return nr;
  });
  return { grid: next, moved, gained };
}

function moveRight(grid: Grid): { grid: Grid; moved: boolean; gained: number } {
  const flipped = grid.map((row) => [...row].reverse());
  const { grid: after, moved, gained } = moveLeft(flipped);
  const next = after.map((row) => [...row].reverse());
  return { grid: next, moved, gained };
}

function moveUp(grid: Grid): { grid: Grid; moved: boolean; gained: number } {
  let moved = false;
  let gained = 0;
  const next = emptyGrid();
  for (let c = 0; c < SIZE; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
    const { next: merged, gained: g } = slideAndMergeLine(col);
    gained += g;
    for (let r = 0; r < SIZE; r++) {
      next[r][c] = merged[r];
      if (merged[r] !== grid[r][c]) moved = true;
    }
  }
  return { grid: next, moved, gained };
}

function moveDown(grid: Grid): { grid: Grid; moved: boolean; gained: number } {
  let moved = false;
  let gained = 0;
  const next = emptyGrid();
  for (let c = 0; c < SIZE; c++) {
    const col = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]];
    const { next: merged, gained: g } = slideAndMergeLine(col);
    gained += g;
    for (let r = 0; r < SIZE; r++) {
      const writeR = SIZE - 1 - r;
      const val = merged[r];
      next[writeR][c] = val;
      if (val !== grid[writeR][c]) moved = true;
    }
  }
  return { grid: next, moved, gained };
}

type Dir = "up" | "down" | "left" | "right";

function moveGrid(grid: Grid, dir: Dir): { grid: Grid; moved: boolean; gained: number } {
  switch (dir) {
    case "left":
      return moveLeft(grid);
    case "right":
      return moveRight(grid);
    case "up":
      return moveUp(grid);
    case "down":
      return moveDown(grid);
  }
}

function addRandomTile(grid: Grid, rng: () => number): void {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return;
  const pick = empties[Math.floor(rng() * empties.length)]!;
  grid[pick[0]][pick[1]] = rng() < 0.9 ? 2 : 4;
}

function freshGrid(rng: () => number): Grid {
  const g = emptyGrid();
  addRandomTile(g, rng);
  addRandomTile(g, rng);
  return g;
}

function gridHasTarget(grid: Grid, target: number): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === target) return true;
    }
  }
  return false;
}

function canMove(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

function tileCellClass(v: number): string {
  if (v === 0) {
    return "border border-slate-700/50 bg-slate-800/40 shadow-inner";
  }
  const base =
    "flex items-center justify-center rounded-lg border font-semibold shadow-sm tabular-nums transition-colors ";
  if (v === 2) return base + "border-slate-500 bg-slate-600 text-slate-100";
  if (v === 4) return base + "border-slate-400 bg-slate-500 text-white";
  if (v === 8) return base + "border-amber-700 bg-amber-800 text-amber-100";
  if (v === 16) return base + "border-orange-700 bg-orange-800 text-orange-50";
  if (v === 32) return base + "border-orange-600 bg-orange-700 text-white";
  if (v === 64) return base + "border-red-700 bg-red-800 text-red-50";
  if (v <= 256) return base + "border-rose-700 bg-rose-900/90 text-rose-50";
  if (v <= 1024) return base + "border-violet-600 bg-violet-900/90 text-violet-100";
  return base + "border-teal-400 bg-teal-700 text-white";
}

function tileTextClass(v: number): string {
  if (v === 0) return "";
  if (v >= 1000) return "text-base sm:text-lg";
  if (v >= 100) return "text-lg sm:text-xl";
  return "text-xl sm:text-2xl";
}

export function Puzzle2048PanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => Puzzle2048PanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());
  const lostRef = useRef(false);
  const scoreRef = useRef(0);

  const [grid, setGrid] = useState<Grid>(() => freshGrid(rngRef.current));
  const [score, setScore] = useState(0);
  const [lost, setLost] = useState(false);
  const [won, setWon] = useState(false);

  const patchData = useCallback(
    (partial: Partial<Puzzle2048PanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const newGame = useCallback(() => {
    lostRef.current = false;
    scoreRef.current = 0;
    setScore(0);
    setLost(false);
    setWon(false);
    setGrid(freshGrid(rngRef.current));
  }, []);

  useEffect(() => {
    newGame();
  }, [record.id, newGame]);

  useEffect(() => {
    lostRef.current = lost;
  }, [lost]);

  const tryMove = useCallback(
    (dir: Dir) => {
      if (lostRef.current) return;
      setGrid((prev) => {
        const { grid: merged, moved, gained } = moveGrid(prev, dir);
        if (!moved) return prev;
        addRandomTile(merged, rngRef.current);
        const newScore = scoreRef.current + gained;
        scoreRef.current = newScore;
        queueMicrotask(() => {
          setScore(newScore);
          if (!canMove(merged)) setLost(true);
          if (gridHasTarget(merged, 2048)) setWon(true);
          const bs = payloadRef.current.bestScore;
          if (newScore > bs) patchData({ bestScore: newScore });
        });
        return merged;
      });
    },
    [patchData],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lostRef.current) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          tryMove("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          tryMove("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          tryMove("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          tryMove("right");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryMove]);

  const padBtn =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 text-slate-200 hover:border-teal-600/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span>
          Score: <span className="font-mono text-teal-200">{score}</span>
        </span>
        <span>
          Best: <span className="font-mono text-amber-200/90">{payload.bestScore}</span>
        </span>
      </div>

      {won ? (
        <p className="text-[12px] font-medium text-teal-200">You reached 2048 — keep going or start fresh.</p>
      ) : (
        <p className="text-[12px] text-slate-400">Merge tiles with arrow keys or the pad. Goal: 2048.</p>
      )}

      {lost ? (
        <p className="text-[12px] font-medium text-rose-300">No moves left — new game?</p>
      ) : null}

      <div className="relative mx-auto w-full max-w-[17rem]">
        <div
          className="grid aspect-square w-full grid-cols-4 gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 p-2 sm:max-w-[19rem]"
          style={{ touchAction: "none" }}
        >
          {grid.map((row, r) =>
            row.map((v, c) => (
              <div key={`${r}-${c}`} className={`aspect-square min-h-0 ${tileCellClass(v)}`}>
                {v > 0 ? <span className={tileTextClass(v)}>{v}</span> : null}
              </div>
            )),
          )}
        </div>
      </div>

      <div className="mx-auto flex flex-col items-center gap-2">
        <div className="grid grid-cols-3 gap-1.5 place-items-center">
          <span />
          <button type="button" className={padBtn} aria-label="Up" disabled={lost} onClick={() => tryMove("up")}>
            ↑
          </button>
          <span />
          <button type="button" className={padBtn} aria-label="Left" disabled={lost} onClick={() => tryMove("left")}>
            ←
          </button>
          <button type="button" className={padBtn} aria-label="Down" disabled={lost} onClick={() => tryMove("down")}>
            ↓
          </button>
          <button type="button" className={padBtn} aria-label="Right" disabled={lost} onClick={() => tryMove("right")}>
            →
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={newGame}
        >
          New game
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #14: classic 2048 on a 4×4 grid. Agent kind <code className="text-slate-400">puzzle-2048-panel</code>.
      </p>
    </div>
  );
}
