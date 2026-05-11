import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { WidgetRecord } from "@airis/shared";
import {
  PianoRollPanelPayloadSchema,
  PianoRollWaveformSchema,
  type PianoRollPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

/** Shared `Tone.Transport` — avoid multiple music widgets playing at once. */
const STEPS = 16;
const ROWS = 12;

const NOTE_NAMES = [
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
] as const;

const BLACK_KEY_ROWS = new Set([1, 3, 6, 8, 10]);

function shortLabel(note: string): string {
  return note.replace("4", "");
}

function applyPolyFromPayload(poly: Tone.PolySynth, p: PianoRollPanelPayload) {
  poly.set({
    oscillator: { type: p.waveform },
    envelope: {
      attack: p.attack,
      decay: Math.max(0.001, p.decay),
      sustain: p.sustain,
      release: Math.max(0.001, p.release),
    },
  });
}

export function PianoRollPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => PianoRollPanelPayloadSchema.parse(record.data), [record.data]);

  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const polyRef = useRef<Tone.PolySynth | null>(null);
  const repeatIdRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const ensurePoly = useCallback(() => {
    const p = payloadRef.current;
    if (!polyRef.current) {
      polyRef.current = new Tone.PolySynth({
        maxPolyphony: 16,
        voice: Tone.Synth,
      }).toDestination();
      polyRef.current.volume.value = -8;
    }
    applyPolyFromPayload(polyRef.current, p);
  }, []);

  const applyTransportBpm = useCallback(() => {
    Tone.Transport.bpm.value = payloadRef.current.bpm;
    Tone.Transport.swing = 0;
  }, []);

  const stopPlayback = useCallback(() => {
    if (repeatIdRef.current != null) {
      Tone.Transport.clear(repeatIdRef.current);
      repeatIdRef.current = null;
    }
    polyRef.current?.releaseAll();
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    stepRef.current = 0;
    setPlayhead(0);
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    ensurePoly();
    stopPlayback();
    applyTransportBpm();
    setPlaying(true);

    const id = Tone.Transport.scheduleRepeat((time) => {
      const p = payloadRef.current;
      const i = stepRef.current % STEPS;
      const notes: string[] = [];
      for (let r = 0; r < ROWS; r++) {
        if (p.grid[r]?.[i]) notes.push(NOTE_NAMES[r]);
      }
      if (notes.length > 0 && polyRef.current) {
        polyRef.current.triggerAttackRelease(notes, "16n", time, 0.78);
      }
      Tone.Draw.schedule(() => setPlayhead(i), time);
      stepRef.current += 1;
    }, "16n");

    repeatIdRef.current = id;
    Tone.Transport.start();
  }, [applyTransportBpm, ensurePoly, stopPlayback]);

  useEffect(() => {
    if (!playing) return;
    applyTransportBpm();
  }, [playing, applyTransportBpm, payload.bpm]);

  useEffect(() => {
    if (!polyRef.current) return;
    applyPolyFromPayload(polyRef.current, payload);
  }, [payload.waveform, payload.attack, payload.decay, payload.sustain, payload.release]);

  useEffect(
    () => () => {
      stopPlayback();
      polyRef.current?.dispose();
      polyRef.current = null;
    },
    [stopPlayback],
  );

  const toggleCell = (row: number, col: number) => {
    const g = payload.grid.map((r) => [...r]);
    g[row][col] = !g[row][col];
    void patchWidgetRecord(record.id, { data: { grid: g } });
  };

  const displayRowOrder = useMemo(() => Array.from({ length: ROWS }, (_, k) => ROWS - 1 - k), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-xs text-slate-500">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          aria-pressed={playing}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            playing
              ? "border-rose-600/70 bg-rose-950/60 text-rose-100"
              : "border-violet-600/50 bg-slate-900/90 text-violet-200 hover:border-violet-400/60"
          }`}
          onClick={() => (playing ? stopPlayback() : void startPlayback())}
        >
          {playing ? "Stop" : "Play"}
        </button>
        <label className="flex min-w-[9rem] flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Tempo {payload.bpm} BPM
          <input
            type="range"
            min={40}
            max={240}
            value={payload.bpm}
            className="accent-violet-500"
            onChange={(e) => {
              const bpm = Number(e.target.value);
              void patchWidgetRecord(record.id, { data: { bpm } });
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Waveform
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            value={payload.waveform}
            onChange={(e) => {
              const w = PianoRollWaveformSchema.safeParse(e.target.value);
              if (w.success) void patchWidgetRecord(record.id, { data: { waveform: w.data } });
            }}
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Saw</option>
            <option value="triangle">Triangle</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">ADSR envelope</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["attack", payload.attack, 0.001, 2, "Attack"] as const,
              ["decay", payload.decay, 0, 2, "Decay"] as const,
              ["sustain", payload.sustain, 0, 1, "Sustain"] as const,
              ["release", payload.release, 0.001, 3, "Release"] as const,
            ] as const
          ).map(([key, val, min, max, label]) => (
            <label key={key} className="flex flex-col gap-1 text-[10px] text-slate-500">
              {label}{" "}
              <span className="font-mono text-slate-400">{val.toFixed(3)}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={key === "sustain" ? 0.01 : 0.005}
                value={val}
                className="accent-fuchsia-500"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void patchWidgetRecord(record.id, { data: { [key]: v } });
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/40 p-2">
        <div className="inline-block min-w-full">
          <div className="mb-1 flex">
            <span className="w-8 shrink-0" />
            {Array.from({ length: STEPS }, (_, c) => (
              <div
                key={c}
                className={`flex w-7 shrink-0 justify-center text-[9px] font-mono ${
                  playing && playhead === c ? "text-fuchsia-300" : "text-slate-600"
                }`}
              >
                {c + 1}
              </div>
            ))}
          </div>
          {displayRowOrder.map((noteIdx) => {
            const black = BLACK_KEY_ROWS.has(noteIdx);
            return (
              <div key={noteIdx} className="flex items-stretch">
                <div
                  className={`flex w-8 shrink-0 items-center justify-end pr-1 text-[9px] font-mono ${
                    black ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {shortLabel(NOTE_NAMES[noteIdx])}
                </div>
                {Array.from({ length: STEPS }, (_, stepIdx) => {
                  const on = Boolean(payload.grid[noteIdx]?.[stepIdx]);
                  const head = playing && playhead === stepIdx;
                  return (
                    <button
                      key={stepIdx}
                      type="button"
                      aria-label={`${NOTE_NAMES[noteIdx]} step ${stepIdx + 1}`}
                      aria-pressed={on}
                      className={`m-[1px] h-6 w-7 shrink-0 rounded-sm border text-[0] transition ${
                        head
                          ? on
                            ? "border-fuchsia-300 bg-fuchsia-600/70 shadow-[0_0_10px_rgba(217,70,239,0.45)]"
                            : "border-cyan-400/50 bg-slate-900 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                          : on
                            ? "border-fuchsia-500/80 bg-fuchsia-950/80 shadow-[0_0_6px_rgba(192,38,211,0.35)]"
                            : black
                              ? "border-slate-800 bg-slate-900/90 hover:border-slate-600"
                              : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                      }`}
                      onClick={() => toggleCell(noteIdx, stepIdx)}
                    >
                      ·
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #2: C4–B4 × 16 steps, Tone.PolySynth. Agent kind <code className="text-slate-400">piano-roll-panel</code>
        ; <code className="text-slate-400">grid</code> is 12×16 booleans (row 0 = C4, row 11 = B4).
      </p>
    </div>
  );
}
