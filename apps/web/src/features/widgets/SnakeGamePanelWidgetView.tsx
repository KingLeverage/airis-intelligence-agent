import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { SnakeGamePanelPayloadSchema, type SnakeGamePanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const GRID = 18;
const BASE_TICK_MS = 145;
const MIN_TICK_MS = 72;
const TICK_STEP = 4;

type Pt = { x: number; y: number };

function same(a: Pt, b: Pt): boolean {
  return a.x === b.x && a.y === b.y;
}

function opposite(d: Pt, e: Pt): boolean {
  return d.x === -e.x && d.y === -e.y;
}

function randomFood(rng: () => number, snake: Pt[]): Pt {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  for (let n = 0; n < 400; n++) {
    const x = Math.floor(rng() * GRID);
    const y = Math.floor(rng() * GRID);
    const k = `${x},${y}`;
    if (!taken.has(k)) return { x, y };
  }
  return { x: 0, y: 0 };
}

type GameModel = {
  snake: Pt[];
  dir: Pt;
  queued: Pt | null;
  food: Pt;
  alive: boolean;
  score: number;
  tickMs: number;
};

function initialModel(): GameModel {
  const mid = Math.floor(GRID / 2);
  return {
    snake: [
      { x: mid + 1, y: mid },
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
    ],
    dir: { x: 1, y: 0 },
    queued: null,
    food: { x: mid, y: mid - 3 },
    alive: true,
    score: 0,
    tickMs: BASE_TICK_MS,
  };
}

function drawGame(canvas: HTMLCanvasElement, m: GameModel): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cell = Math.min(w, h) / GRID;
  const ox = (w - cell * GRID) / 2;
  const oy = (h - cell * GRID) / 2;

  ctx.fillStyle = "rgb(15 23 42)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgb(30 41 59)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const p = ox + i * cell;
    ctx.beginPath();
    ctx.moveTo(p, oy);
    ctx.lineTo(p, oy + cell * GRID);
    ctx.stroke();
    const q = oy + i * cell;
    ctx.beginPath();
    ctx.moveTo(ox, q);
    ctx.lineTo(ox + cell * GRID, q);
    ctx.stroke();
  }

  ctx.fillStyle = "rgb(248 113 113)";
  ctx.beginPath();
  ctx.arc(ox + (m.food.x + 0.5) * cell, oy + (m.food.y + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
  ctx.fill();

  m.snake.forEach((seg, i) => {
    const t = i / Math.max(1, m.snake.length - 1);
    const g = Math.round(52 + t * 140);
    const b = Math.round(120 + t * 90);
    ctx.fillStyle = `rgb(16 ${g} ${b})`;
    const pad = cell * 0.12;
    ctx.fillRect(ox + seg.x * cell + pad, oy + seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
    if (i === 0) {
      ctx.fillStyle = "rgb(167 243 208)";
      ctx.fillRect(ox + seg.x * cell + cell * 0.28, oy + seg.y * cell + cell * 0.28, cell * 0.16, cell * 0.16);
      ctx.fillRect(ox + seg.x * cell + cell * 0.56, oy + seg.y * cell + cell * 0.28, cell * 0.16, cell * 0.16);
    }
  });
}

export function SnakeGamePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => SnakeGamePanelPayloadSchema.parse(record.data), [record.data]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<GameModel>(initialModel());
  const tickRef = useRef<number | undefined>(undefined);
  const playingRef = useRef(false);
  const rngRef = useRef(() => Math.random());

  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(payload.bestScore);
  const [showStartHint, setShowStartHint] = useState(true);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const patchData = useCallback(
    (partial: Partial<SnakeGamePanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  useEffect(() => {
    setBest(payload.bestScore);
  }, [payload.bestScore]);

  const stopLoop = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = undefined;
    }
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const m = modelRef.current;
    if (!m.alive) return;

    let dir = m.dir;
    if (m.queued && !opposite(m.queued, m.dir)) {
      dir = m.queued;
    }
    m.dir = dir;
    m.queued = null;

    const head = m.snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
      m.alive = false;
      stopLoop();
      const bs = payloadRef.current.bestScore;
      if (m.score > bs) {
        patchData({ bestScore: m.score });
        setBest(m.score);
      }
      drawGame(canvas, m);
      return;
    }

    if (m.snake.some((s) => same(s, next))) {
      m.alive = false;
      stopLoop();
      const bs = payloadRef.current.bestScore;
      if (m.score > bs) {
        patchData({ bestScore: m.score });
        setBest(m.score);
      }
      drawGame(canvas, m);
      return;
    }

    m.snake.unshift(next);
    if (same(next, m.food)) {
      m.score += 1;
      setScore(m.score);
      m.tickMs = Math.max(MIN_TICK_MS, m.tickMs - TICK_STEP);
      m.food = randomFood(rngRef.current, m.snake);
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = window.setInterval(tick, m.tickMs);
      }
    } else {
      m.snake.pop();
    }

    drawGame(canvas, m);
  }, [patchData, stopLoop]);

  const startGame = useCallback(() => {
    stopLoop();
    const canvas = canvasRef.current;
    modelRef.current = initialModel();
    modelRef.current.food = randomFood(rngRef.current, modelRef.current.snake);
    setScore(0);
    setShowStartHint(false);
    if (canvas) drawGame(canvas, modelRef.current);
    playingRef.current = true;
    setPlaying(true);
    tickRef.current = window.setInterval(tick, modelRef.current.tickMs);
  }, [stopLoop, tick]);

  const queueDir = useCallback((d: Pt) => {
    const m = modelRef.current;
    if (!m.alive || !playingRef.current) return;
    if (opposite(d, m.dir)) return;
    m.queued = d;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playingRef.current && e.key !== " ") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          queueDir({ x: 0, y: -1 });
          break;
        case "ArrowDown":
          e.preventDefault();
          queueDir({ x: 0, y: 1 });
          break;
        case "ArrowLeft":
          e.preventDefault();
          queueDir({ x: -1, y: 0 });
          break;
        case "ArrowRight":
          e.preventDefault();
          queueDir({ x: 1, y: 0 });
          break;
        case "w":
        case "W":
          queueDir({ x: 0, y: -1 });
          break;
        case "s":
        case "S":
          queueDir({ x: 0, y: 1 });
          break;
        case "a":
        case "A":
          queueDir({ x: -1, y: 0 });
          break;
        case "d":
        case "D":
          queueDir({ x: 1, y: 0 });
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueDir]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const d = Math.max(160, Math.floor(Math.min(r.width, r.height) - 4));
      canvas.width = d;
      canvas.height = d;
      drawGame(canvas, modelRef.current);
    });
    ro.observe(canvas.parentElement ?? canvas);
    return () => {
      ro.disconnect();
      stopLoop();
    };
  }, [stopLoop]);

  const padBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-40";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-400">{payload.subtitle}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          Score: <span className="font-mono text-teal-200">{score}</span>
        </span>
        <span>
          Best: <span className="font-mono text-amber-200/90">{best}</span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-950/40 p-2">
        <canvas ref={canvasRef} className="mx-auto block max-h-[min(52vh,420px)] w-full max-w-full" />
        {!playing && showStartHint ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/55">
            <p className="text-center text-[12px] font-medium text-slate-200">Press Start — arrows or WASD</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="grid grid-cols-3 gap-1" aria-label="Direction pad">
          <span />
          <button type="button" className={padBtn} disabled={!playing} onClick={() => queueDir({ x: 0, y: -1 })} aria-label="Up">
            ↑
          </button>
          <span />
          <button type="button" className={padBtn} disabled={!playing} onClick={() => queueDir({ x: -1, y: 0 })} aria-label="Left">
            ←
          </button>
          <span className="h-9 w-9" />
          <button type="button" className={padBtn} disabled={!playing} onClick={() => queueDir({ x: 1, y: 0 })} aria-label="Right">
            →
          </button>
          <span />
          <button type="button" className={padBtn} disabled={!playing} onClick={() => queueDir({ x: 0, y: 1 })} aria-label="Down">
            ↓
          </button>
          <span />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
            onClick={startGame}
          >
            {playing ? "New game" : "Start"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-[12px] text-slate-200 hover:bg-slate-700"
            onClick={startGame}
          >
            Restart
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #11: grid snake, wrap-free walls, speed ramps with score. Agent kind{" "}
        <code className="text-slate-400">snake-game-panel</code>.
      </p>
    </div>
  );
}
