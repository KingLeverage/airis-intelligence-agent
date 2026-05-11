import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { WidgetRecord } from "@airis/shared";
import {
  PianoRollWaveformSchema,
  SynthKeyboardPanelPayloadSchema,
  type SynthKeyboardPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

/** MIDI number of C for scientific octave n (e.g. 4 → 60 = C4). */
function midiForRootC(octave: number): number {
  return 12 * (octave + 1);
}

const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11] as const;
const BLACK_SEMIS = [1, 3, 6, 8, 10] as const;
/** Left edge % within one octave (white key row = 100% width). */
const BLACK_LEFT_PCT = [10.5, 24.5, 53.5, 67.5, 81.5];

function applyPolyFromPayload(poly: Tone.PolySynth, p: SynthKeyboardPanelPayload) {
  poly.set({
    oscillator: { type: p.waveform },
    envelope: {
      attack: p.attack,
      decay: Math.max(0.001, p.decay),
      sustain: p.sustain,
      release: Math.max(0.001, p.release),
    },
  });
  poly.volume.value = p.volumeDb;
}

type OctaveBlockProps = {
  baseMidi: number;
  held: ReadonlySet<string>;
  onDown: (note: string, e: React.PointerEvent) => void;
  onUp: (note: string, e: React.PointerEvent) => void;
};

function OctaveBlock({ baseMidi, held, onDown, onUp }: OctaveBlockProps) {
  return (
    <div className="relative min-w-[6.5rem] flex-1 shrink-0">
      <div className="relative flex h-[7.5rem] w-full">
        {WHITE_SEMIS.map((semi) => {
          const midi = baseMidi + semi;
          const note = Tone.Frequency(midi, "midi").toNote();
          const label = note.replace(/\d/g, "");
          const down = held.has(note);
          return (
            <button
              key={note}
              type="button"
              aria-label={note}
              className={`mx-px flex flex-1 flex-col items-center justify-end rounded-b-md border border-slate-700 bg-gradient-to-b from-slate-200 to-slate-400 pb-1 text-[10px] font-medium text-slate-900 shadow-inner first:rounded-bl-md last:rounded-br-md hover:from-white hover:to-slate-300 active:from-slate-300 ${
                down ? "from-teal-200 to-teal-400 ring-2 ring-teal-500/60" : ""
              }`}
              onPointerDown={(e) => onDown(note, e)}
              onPointerUp={(e) => onUp(note, e)}
              onPointerCancel={(e) => onUp(note, e)}
            >
              <span className="pointer-events-none">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[4.5rem] w-full">
        {BLACK_SEMIS.map((semi, bi) => {
          const midi = baseMidi + semi;
          const note = Tone.Frequency(midi, "midi").toNote();
          const label = note.replace(/\d/g, "");
          const down = held.has(note);
          return (
            <button
              key={note}
              type="button"
              aria-label={note}
              className={`pointer-events-auto absolute top-0 h-full min-h-[3rem] w-[11%] min-w-[14px] max-w-[2.1rem] rounded-b-md border border-slate-950 bg-gradient-to-b from-slate-700 to-slate-950 text-[0] text-slate-400 shadow-lg hover:from-slate-600 active:from-slate-800 ${
                down ? "from-violet-600 to-violet-950 ring-2 ring-violet-400/50" : ""
              }`}
              style={{ left: BLACK_LEFT_PCT[bi] ?? "0%" }}
              onPointerDown={(e) => onDown(note, e)}
              onPointerUp={(e) => onUp(note, e)}
              onPointerCancel={(e) => onUp(note, e)}
            >
              <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium text-slate-500">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** PolySynth only — no `Transport` (same idea as chord pads). */
export function SynthKeyboardPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => SynthKeyboardPanelPayloadSchema.parse(record.data), [record.data]);

  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const polyRef = useRef<Tone.PolySynth | null>(null);

  const ensurePoly = useCallback(() => {
    const p = payloadRef.current;
    if (!polyRef.current) {
      polyRef.current = new Tone.PolySynth({
        maxPolyphony: 32,
        voice: Tone.Synth,
      }).toDestination();
    }
    applyPolyFromPayload(polyRef.current, p);
  }, []);

  useEffect(() => {
    ensurePoly();
  }, [ensurePoly, payload]);

  const noteDown = useCallback(
    async (note: string, e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      await Tone.start();
      ensurePoly();
      polyRef.current?.triggerAttack(note);
      setHeld((prev) => new Set(prev).add(note));
    },
    [ensurePoly],
  );

  const noteUp = useCallback((note: string, e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    polyRef.current?.triggerRelease(note);
    setHeld((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      polyRef.current?.releaseAll();
      polyRef.current?.dispose();
      polyRef.current = null;
    },
    [],
  );

  const rootMidi = useMemo(() => midiForRootC(payload.rootMidiOctave), [payload.rootMidiOctave]);
  const octaves = useMemo(
    () => Array.from({ length: payload.spanOctaves }, (_, o) => rootMidi + o * 12),
    [payload.spanOctaves, rootMidi],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>Octave</span>
          <button
            type="button"
            className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            disabled={payload.rootMidiOctave <= 2}
            onClick={() =>
              void patchWidgetRecord(record.id, {
                data: { rootMidiOctave: payload.rootMidiOctave - 1 },
              })
            }
            aria-label="Lower octave"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center font-mono text-slate-300">
            C{payload.rootMidiOctave}
          </span>
          <button
            type="button"
            className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            disabled={payload.rootMidiOctave >= 6}
            onClick={() =>
              void patchWidgetRecord(record.id, {
                data: { rootMidiOctave: payload.rootMidiOctave + 1 },
              })
            }
            aria-label="Raise octave"
          >
            +
          </button>
        </div>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Width
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200"
            value={payload.spanOctaves}
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { spanOctaves: Number(e.target.value) } })
            }
          >
            <option value={1}>1 octave</option>
            <option value={2}>2 octaves</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Wave
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200"
            value={payload.waveform}
            onChange={(e) => {
              const w = PianoRollWaveformSchema.safeParse(e.target.value);
              if (w.success) void patchWidgetRecord(record.id, { data: { waveform: w.data } });
            }}
          >
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
            <option value="sawtooth">Saw</option>
          </select>
        </label>
        <label className="flex min-w-[5.5rem] flex-col gap-0.5 text-[10px] text-slate-500">
          Vol {payload.volumeDb} dB
          <input
            type="range"
            min={-36}
            max={6}
            step={1}
            value={payload.volumeDb}
            className="w-full accent-fuchsia-400"
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { volumeDb: Number(e.target.value) } })
            }
          />
        </label>
      </div>

      <div className="flex min-h-0 w-full gap-1 overflow-x-auto pb-1 pt-1">
        {octaves.map((base) => (
          <OctaveBlock key={base} baseMidi={base} held={held} onDown={noteDown} onUp={noteUp} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
        {(
          [
            ["attack", payload.attack, 0.001, 2, 0.001],
            ["decay", payload.decay, 0, 2, 0.01],
            ["sustain", payload.sustain, 0, 1, 0.01],
            ["release", payload.release, 0.001, 3, 0.01],
          ] as const
        ).map(([key, val, min, max, step]) => (
          <label key={key} className="flex flex-col gap-0.5 text-[9px] uppercase text-slate-500">
            {key}
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={val}
              className="w-full accent-cyan-500/80"
              onChange={(e) =>
                void patchWidgetRecord(record.id, { data: { [key]: Number(e.target.value) } })
              }
            />
          </label>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #6: <code className="text-slate-400">Tone.PolySynth</code> keys (no Transport). Agent
        kind <code className="text-slate-400">synth-keyboard-panel</code>.
      </p>
    </div>
  );
}
