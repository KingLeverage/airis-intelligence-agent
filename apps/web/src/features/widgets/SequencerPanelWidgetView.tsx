import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { SequencerPanelPayloadSchema } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

function msPerStep(bpm: number): number {
  return (60 / bpm / 4) * 1000;
}

function playClick(ctx: AudioContext, accent: boolean) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(accent ? 520 : 380, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

const STEP_OPTIONS = [8, 12, 16, 24, 32] as const;

export function SequencerPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => SequencerPanelPayloadSchema.parse(record.data), [record.data]);

  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const stepIndexRef = useRef(0);
  const payloadRef = useRef(payload);
  const audioRef = useRef<AudioContext | null>(null);

  payloadRef.current = payload;

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    setPlayhead(0);
    stepIndexRef.current = 0;
  }, []);

  useEffect(() => {
    if (!playing) return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const run = async () => {
      if (!audioRef.current) audioRef.current = new AudioCtx();
      await audioRef.current.resume();
    };
    void run();

    const stepMs = msPerStep(payload.bpm);
    const id = window.setInterval(() => {
      const p = payloadRef.current;
      const n = p.steps;
      const i = stepIndexRef.current % n;
      setPlayhead(i);
      if (p.pattern[i] && audioRef.current?.state === "running") {
        playClick(audioRef.current, i % 4 === 0);
      }
      stepIndexRef.current = (stepIndexRef.current + 1) % n;
    }, stepMs);

    return () => window.clearInterval(id);
  }, [playing, payload.bpm, payload.steps, payload.pattern]);

  const toggleStep = (i: number) => {
    const next = payload.pattern.map((v, j) => (j === i ? !v : v));
    void patchWidgetRecord(record.id, { data: { pattern: next } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-xs text-slate-500">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={playing}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            playing
              ? "border-rose-700/60 bg-rose-950/50 text-rose-100"
              : "border-cyan-800/60 bg-slate-900/80 text-cyan-100 hover:border-cyan-600/50"
          }`}
          onClick={() => (playing ? stopPlayback() : setPlaying(true))}
        >
          {playing ? "Stop" : "Play"}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
          BPM
          <input
            type="number"
            min={40}
            max={240}
            className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-200"
            value={payload.bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const bpm = Math.min(240, Math.max(40, Math.round(v)));
              void patchWidgetRecord(record.id, { data: { bpm } });
            }}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
          Steps
          <select
            className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-200"
            value={payload.steps}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!STEP_OPTIONS.includes(n as (typeof STEP_OPTIONS)[number])) return;
              void patchWidgetRecord(record.id, { data: { steps: n } });
            }}
          >
            {STEP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Step pattern">
        {payload.pattern.map((on, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Step ${i + 1}`}
            aria-pressed={on}
            className={`h-9 min-w-[2.25rem] rounded-md border text-[11px] font-semibold transition ${
              playing && playhead === i
                ? on
                  ? "border-cyan-300 bg-cyan-600/40 text-white ring-1 ring-cyan-300/60"
                  : "border-slate-500 bg-slate-800/80 text-slate-500 ring-1 ring-cyan-400/40"
                : on
                  ? "border-cyan-700/70 bg-cyan-950/50 text-cyan-100"
                  : "border-slate-700 bg-slate-900/60 text-slate-500 hover:border-slate-600"
            }`}
            onClick={() => toggleStep(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        Each step is a 16th note. Edits save to the workspace automatically — the agent can create this widget with{" "}
        <code className="text-slate-400">sequencer-panel</code> and a <code className="text-slate-400">pattern</code>{" "}
        array.
      </p>
    </div>
  );
}
