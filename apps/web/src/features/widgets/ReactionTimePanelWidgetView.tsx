import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { ReactionTimePanelPayloadSchema, type ReactionTimePanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

type Phase = "idle" | "waiting" | "go" | "early" | "result";

function randBetween(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function ReactionTimePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => ReactionTimePanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAtRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [lastMs, setLastMs] = useState<number | null>(null);

  const patchData = useCallback(
    (partial: Partial<ReactionTimePanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current != null) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearWaitTimer();
  }, [clearWaitTimer]);

  useEffect(() => {
    setPhase("idle");
    setLastMs(null);
    clearWaitTimer();
  }, [record.id, clearWaitTimer]);

  const armRound = useCallback(() => {
    clearWaitTimer();
    setLastMs(null);
    setPhase("waiting");
    const delay = randBetween(900, 4200, rngRef.current);
    waitTimerRef.current = setTimeout(() => {
      waitTimerRef.current = null;
      goAtRef.current = performance.now();
      setPhase("go");
    }, delay);
  }, [clearWaitTimer]);

  const onTap = useCallback(() => {
    if (phase === "idle" || phase === "result" || phase === "early") {
      armRound();
      return;
    }
    if (phase === "waiting") {
      clearWaitTimer();
      setPhase("early");
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - goAtRef.current);
      setLastMs(ms);
      setPhase("result");
      const prev = payloadRef.current.bestReactionMs;
      const nextBest = prev === 0 ? ms : Math.min(prev, ms);
      if (nextBest !== prev) patchData({ bestReactionMs: nextBest });
    }
  }, [phase, armRound, clearWaitTimer, patchData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onTap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTap]);

  const best = payload.bestReactionMs;
  const panelBg =
    phase === "go"
      ? "bg-emerald-600/90 border-emerald-400/80"
      : phase === "waiting"
        ? "bg-rose-900/70 border-rose-600/60"
        : phase === "early"
          ? "bg-amber-900/60 border-amber-500/50"
          : "bg-slate-900/80 border-slate-700/80";

  const panelLabel =
    phase === "idle"
      ? "Tap or press Space to start"
      : phase === "waiting"
        ? "Wait for green…"
        : phase === "go"
          ? "CLICK!"
          : phase === "early"
            ? "Too soon — try again"
            : lastMs != null
              ? `${lastMs} ms`
              : "Done";

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span>
          Best:{" "}
          <span className="font-mono text-teal-300">{best > 0 ? `${best} ms` : "—"}</span>
        </span>
        {lastMs != null && phase === "result" ? (
          <span className="text-slate-500">
            Last: <span className="font-mono text-slate-300">{lastMs} ms</span>
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onTap}
        className={`flex min-h-[10rem] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-4 py-6 text-center shadow-inner transition-colors ${panelBg}`}
      >
        <span className="text-lg font-bold tracking-tight text-white drop-shadow-sm">{panelLabel}</span>
        <span className="mt-2 text-[11px] font-normal text-white/80">
          {phase === "result" ? "Tap for another round" : null}
          {phase === "early" ? "Tap to retry" : null}
        </span>
      </button>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #20: random-delay reaction test. Agent kind{" "}
        <code className="text-slate-400">reaction-time-panel</code>.
      </p>
    </div>
  );
}
