import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { PongPanelPayloadSchema, type PongPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const WIN_POINTS = 5;
const W = 520;
const H = 300;
const PADDLE_W = 10;
const PADDLE_H = 70;
const BALL_R = 7;
const PLAYER_X = 24;
const AI_X = W - 24 - PADDLE_W;
const PADDLE_SPEED = 320;
const BALL_BASE = 280;

type Keys = { up: boolean; down: boolean };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function resetBall(towardAi: boolean): { x: number; y: number; vx: number; vy: number } {
  const angle = (Math.random() * 0.5 + 0.15) * Math.PI * (Math.random() < 0.5 ? -1 : 1);
  const speed = BALL_BASE * (0.95 + Math.random() * 0.12);
  const vx = (towardAi ? 1 : -1) * Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return { x: W / 2, y: H / 2, vx, vy };
}

export function PongPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => PongPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Keys>({ up: false, down: false });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const ballRef = useRef(resetBall(Math.random() < 0.5));
  const pyPlayerRef = useRef(H / 2 - PADDLE_H / 2);
  const pyAiRef = useRef(H / 2 - PADDLE_H / 2);
  const playerPtsRef = useRef(0);
  const aiPtsRef = useRef(0);

  const [playerPts, setPlayerPts] = useState(0);
  const [aiPts, setAiPts] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  const patchData = useCallback(
    (partial: Partial<PongPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const syncScoreUi = useCallback(() => {
    setPlayerPts(playerPtsRef.current);
    setAiPts(aiPtsRef.current);
  }, []);

  const newMatch = useCallback(() => {
    playerPtsRef.current = 0;
    aiPtsRef.current = 0;
    ballRef.current = resetBall(Math.random() < 0.5);
    pyPlayerRef.current = H / 2 - PADDLE_H / 2;
    pyAiRef.current = H / 2 - PADDLE_H / 2;
    setBanner(null);
    syncScoreUi();
  }, [syncScoreUi]);

  useEffect(() => {
    newMatch();
  }, [record.id, newMatch]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 2200);
    return () => window.clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.up = true;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.down = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.up = false;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tick = (t: number) => {
      const last = lastRef.current;
      lastRef.current = t;
      const dt = last == null ? 0 : Math.min(0.05, (t - last) / 1000);

      const keys = keysRef.current;
      let py = pyPlayerRef.current;
      if (keys.up) py -= PADDLE_SPEED * dt;
      if (keys.down) py += PADDLE_SPEED * dt;
      py = clamp(py, 8, H - 8 - PADDLE_H);
      pyPlayerRef.current = py;

      const ball = ballRef.current;
      let { x, y, vx, vy } = ball;

      const ai = pyAiRef.current;
      const aiCenter = ai + PADDLE_H / 2;
      const target = y;
      const delta = target - aiCenter;
      const aiMove = clamp(delta, -240 * dt, 240 * dt);
      pyAiRef.current = clamp(ai + aiMove, 8, H - 8 - PADDLE_H);

      x += vx * dt;
      y += vy * dt;

      if (y - BALL_R < 0) {
        y = BALL_R;
        vy = Math.abs(vy);
      } else if (y + BALL_R > H) {
        y = H - BALL_R;
        vy = -Math.abs(vy);
      }

      const playerTop = pyPlayerRef.current;
      const playerBottom = playerTop + PADDLE_H;
      if (x - BALL_R < PLAYER_X + PADDLE_W && x + BALL_R > PLAYER_X && y > playerTop && y < playerBottom) {
        x = PLAYER_X + PADDLE_W + BALL_R;
        const hit = (y - (playerTop + PADDLE_H / 2)) / (PADDLE_H / 2);
        vx = Math.abs(vx) * 1.03;
        vy += hit * 120;
      }

      const aiTop = pyAiRef.current;
      const aiBottom = aiTop + PADDLE_H;
      if (x + BALL_R > AI_X && x - BALL_R < AI_X + PADDLE_W && y > aiTop && y < aiBottom) {
        x = AI_X - BALL_R;
        const hit = (y - (aiTop + PADDLE_H / 2)) / (PADDLE_H / 2);
        vx = -Math.abs(vx) * 1.03;
        vy += hit * 120;
      }

      let scored: "player" | "ai" | null = null;
      if (x < -20) scored = "ai";
      else if (x > W + 20) scored = "player";

      if (scored) {
        if (scored === "player") playerPtsRef.current++;
        else aiPtsRef.current++;
        syncScoreUi();

        if (playerPtsRef.current >= WIN_POINTS) {
          const p = payloadRef.current;
          patchData({ playerWins: p.playerWins + 1 });
          setBanner("You win the match — starting next…");
          playerPtsRef.current = 0;
          aiPtsRef.current = 0;
          ballRef.current = resetBall(true);
          syncScoreUi();
        } else if (aiPtsRef.current >= WIN_POINTS) {
          const p = payloadRef.current;
          patchData({ aiWins: p.aiWins + 1 });
          setBanner("AI wins the match — starting next…");
          playerPtsRef.current = 0;
          aiPtsRef.current = 0;
          ballRef.current = resetBall(false);
          syncScoreUi();
        } else {
          ballRef.current = resetBall(scored === "ai");
        }
        x = ballRef.current.x;
        y = ballRef.current.y;
        vx = ballRef.current.vx;
        vy = ballRef.current.vy;
      }

      ballRef.current = { x, y, vx, vy };

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.setLineDash([6, 10]);
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#5eead4";
        ctx.fillRect(PLAYER_X, pyPlayerRef.current, PADDLE_W, PADDLE_H);
        ctx.fillStyle = "#fb7185";
        ctx.fillRect(AI_X, pyAiRef.current, PADDLE_W, PADDLE_H);
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [patchData, syncScoreUi]);

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span>
          Matches — You:{" "}
          <span className="font-mono text-teal-300">{payload.playerWins}</span> · AI:{" "}
          <span className="font-mono text-rose-300">{payload.aiWins}</span>
        </span>
        <span className="text-slate-500">
          Points (first to {WIN_POINTS}):{" "}
          <span className="font-mono text-slate-200">{playerPts}</span>–
          <span className="font-mono text-slate-200">{aiPts}</span>
        </span>
      </div>

      {banner ? <p className="text-[11px] text-amber-300/95">{banner}</p> : null}

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="mx-auto w-full max-w-[520px] rounded-lg border border-slate-800 bg-slate-950"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-3 py-1.5 text-[11px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={newMatch}
        >
          Reset match
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #22: W/S or ↑/↓ vs AI. Agent kind <code className="text-slate-400">pong-panel</code>.
      </p>
    </div>
  );
}
