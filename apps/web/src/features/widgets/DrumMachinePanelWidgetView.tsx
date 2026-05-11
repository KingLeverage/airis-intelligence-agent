import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { WidgetRecord } from "@airis/shared";
import { DrumMachinePanelPayloadSchema } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

/** Shared global `Tone.Transport`: only one drum machine should play at a time across the workspace. */
const STEPS = 16;

function disposeSynths(kick: Tone.MembraneSynth | null, snare: Tone.NoiseSynth | null) {
  kick?.dispose();
  snare?.dispose();
}

export function DrumMachinePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => DrumMachinePanelPayloadSchema.parse(record.data), [record.data]);

  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const kickRef = useRef<Tone.MembraneSynth | null>(null);
  const snareRef = useRef<Tone.NoiseSynth | null>(null);
  const repeatIdRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const applyTransportSettings = useCallback(() => {
    const p = payloadRef.current;
    Tone.Transport.bpm.value = p.bpm;
    const swingAmt = Math.min(0.5, Math.max(0, (p.swing / 100) * 0.5));
    Tone.Transport.swing = swingAmt;
    Tone.Transport.swingSubdivision = "16n";
  }, []);

  const stopPlayback = useCallback(() => {
    if (repeatIdRef.current != null) {
      Tone.Transport.clear(repeatIdRef.current);
      repeatIdRef.current = null;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    stepRef.current = 0;
    setPlayhead(0);
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    if (!kickRef.current) {
      kickRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.018,
        octaves: 5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.1 },
      }).toDestination();
      kickRef.current.volume.value = -3;
    }
    if (!snareRef.current) {
      snareRef.current = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      }).toDestination();
      snareRef.current.volume.value = -8;
    }

    stopPlayback();
    applyTransportSettings();
    stepRef.current = 0;
    setPlaying(true);

    const id = Tone.Transport.scheduleRepeat((time) => {
      const p = payloadRef.current;
      const i = stepRef.current % STEPS;
      if (p.kickPattern[i] && kickRef.current) {
        kickRef.current.triggerAttackRelease("C1", "16n", time, 0.95);
      }
      if (p.snarePattern[i] && snareRef.current) {
        snareRef.current.triggerAttackRelease("16n", time, 0.55);
      }
      Tone.Draw.schedule(() => setPlayhead(i), time);
      stepRef.current += 1;
    }, "16n");

    repeatIdRef.current = id;
    Tone.Transport.start();
  }, [applyTransportSettings, stopPlayback]);

  useEffect(() => {
    if (!playing) return;
    applyTransportSettings();
  }, [playing, applyTransportSettings, payload.bpm, payload.swing]);

  useEffect(
    () => () => {
      stopPlayback();
      disposeSynths(kickRef.current, snareRef.current);
      kickRef.current = null;
      snareRef.current = null;
    },
    [stopPlayback],
  );

  const toggleKick = (i: number) => {
    const next = [...payload.kickPattern];
    next[i] = !next[i];
    void patchWidgetRecord(record.id, { data: { kickPattern: next } });
  };

  const toggleSnare = (i: number) => {
    const next = [...payload.snarePattern];
    next[i] = !next[i];
    void patchWidgetRecord(record.id, { data: { snarePattern: next } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-xs text-slate-500">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={playing}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            playing
              ? "border-rose-600/70 bg-rose-950/60 text-rose-100"
              : "border-fuchsia-600/50 bg-slate-900/90 text-fuchsia-200 hover:border-fuchsia-400/60"
          }`}
          onClick={() => (playing ? stopPlayback() : void startPlayback())}
        >
          {playing ? "Stop" : "Play"}
        </button>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          BPM {payload.bpm}
          <input
            type="range"
            min={60}
            max={200}
            value={payload.bpm}
            className="accent-fuchsia-500"
            onChange={(e) => {
              const bpm = Number(e.target.value);
              void patchWidgetRecord(record.id, { data: { bpm } });
            }}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Swing {payload.swing}%
          <input
            type="range"
            min={0}
            max={100}
            value={payload.swing}
            className="accent-fuchsia-500"
            onChange={(e) => {
              const swing = Number(e.target.value);
              void patchWidgetRecord(record.id, { data: { swing } });
            }}
          />
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2">
        <Row
          label="Kick"
          active={payload.kickPattern}
          playhead={playhead}
          playing={playing}
          onToggle={toggleKick}
        />
        <Row
          label="Snare"
          active={payload.snarePattern}
          playhead={playhead}
          playing={playing}
          onToggle={toggleSnare}
        />
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Two-row × 16-step machine using Tone.js (trusted widget renderer). Patterns persist on the space; the agent
        creates <code className="text-slate-400">drum-machine-panel</code> with{" "}
        <code className="text-slate-400">kickPattern</code> / <code className="text-slate-400">snarePattern</code>{" "}
        boolean arrays (length 16).
      </p>
    </div>
  );
}

function Row(props: {
  label: string;
  active: boolean[];
  playhead: number;
  playing: boolean;
  onToggle: (i: number) => void;
}) {
  const { label, active, playhead, playing, onToggle } = props;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div
        className="grid flex-1 gap-1"
        style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
      >
        {active.map((on, i) => {
          const isHead = playing && playhead === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${label} step ${i + 1}`}
              aria-pressed={on}
              className={`h-9 rounded-md border text-[9px] font-bold transition ${
                isHead
                  ? on
                    ? "border-cyan-300 bg-fuchsia-600/50 text-white shadow-[0_0_12px_rgba(244,114,182,0.55)]"
                    : "border-cyan-400/60 bg-slate-900 text-slate-500 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                  : on
                    ? "border-fuchsia-500/70 bg-fuchsia-950/70 text-fuchsia-100 shadow-[0_0_8px_rgba(244,114,182,0.35)]"
                    : "border-slate-800 bg-slate-900/80 text-slate-600 hover:border-slate-600"
              }`}
              onClick={() => onToggle(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
