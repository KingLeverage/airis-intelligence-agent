import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { WidgetRecord } from "@airis/shared";
import { ChordProgressionPanelPayloadSchema } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";
import {
  CHORD_KEY_NAMES,
  buildProgression,
  chordSlotForDegree,
  randomPreset,
} from "./music/chordProgressionTheory";
import { encodeChordProgressionSmf } from "./music/chordProgressionSmf";

async function copyOrDownloadSmf(
  bytes: Uint8Array,
  baseName: string,
): Promise<"clipboard" | "download"> {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "audio/midi" });
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return "clipboard";
    } catch {
      /* fall through */
    }
  }
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${baseName}.mid`;
  a.click();
  URL.revokeObjectURL(url);
  return "download";
}

export function ChordProgressionPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => ChordProgressionPanelPayloadSchema.parse(record.data), [record.data]);

  const progression = useMemo(
    () => buildProgression(payload.keyIndex, payload.mode, payload.degrees),
    [payload.keyIndex, payload.mode, payload.degrees],
  );

  const polyRef = useRef<Tone.PolySynth | null>(null);
  const [midiHint, setMidiHint] = useState<string | null>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  const showHint = useCallback((msg: string) => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setMidiHint(msg);
    hintTimer.current = window.setTimeout(() => setMidiHint(null), 3200);
  }, []);

  const ensurePoly = useCallback(() => {
    if (!polyRef.current) {
      polyRef.current = new Tone.PolySynth({
        maxPolyphony: 8,
        voice: Tone.Synth,
      }).toDestination();
      polyRef.current.volume.value = -10;
      polyRef.current.set({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.08, decay: 0.28, sustain: 0.48, release: 1.85 },
      });
    }
  }, []);

  const playChord = useCallback(async (notes: readonly [string, string, string]) => {
    await Tone.start();
    ensurePoly();
    polyRef.current?.triggerAttackRelease([notes[0], notes[1], notes[2]], "2n");
  }, [ensurePoly]);

  const setDegree = useCallback(
    (slotIndex: number, degree: number) => {
      const next: [number, number, number, number] = [...payload.degrees];
      next[slotIndex] = degree;
      void patchWidgetRecord(record.id, { data: { degrees: next } });
    },
    [patchWidgetRecord, payload.degrees, record.id],
  );

  const onRandomize = useCallback(() => {
    const next = randomPreset(payload.mode);
    void patchWidgetRecord(record.id, { data: { degrees: next } });
  }, [patchWidgetRecord, payload.mode, record.id]);

  const onCopyMidi = useCallback(async () => {
    const triads = progression.map((s) => s.midiNotes);
    const bytes = encodeChordProgressionSmf(triads);
    const key = CHORD_KEY_NAMES[payload.keyIndex];
    const base = `airis-chords-${key}-${payload.mode}`;
    try {
      const how = await copyOrDownloadSmf(bytes, base);
      showHint(how === "clipboard" ? "MIDI copied to clipboard" : "MIDI file downloaded");
    } catch {
      showHint("Could not export MIDI");
    }
  }, [progression, payload.keyIndex, payload.mode, showHint]);

  useEffect(
    () => () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
      polyRef.current?.dispose();
      polyRef.current = null;
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          Key
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200"
            value={payload.keyIndex}
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { keyIndex: Number(e.target.value) } })
            }
          >
            {CHORD_KEY_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          Mode
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200"
            value={payload.mode}
            onChange={(e) =>
              void patchWidgetRecord(record.id, {
                data: { mode: e.target.value as typeof payload.mode },
              })
            }
          >
            <option value="major">Major</option>
            <option value="natural_minor">Natural minor</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-violet-800/70 bg-violet-950/40 px-2 py-1 text-[10px] font-medium text-violet-200 hover:border-violet-600"
          onClick={onRandomize}
        >
          Randomize
        </button>
        <button
          type="button"
          className="rounded-lg border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 text-[10px] font-medium text-cyan-200/90 hover:border-cyan-600"
          onClick={() => void onCopyMidi()}
        >
          Copy MIDI
        </button>
        {midiHint ? <span className="text-[10px] text-slate-500">{midiHint}</span> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
        {progression.map((slot, i) => (
          <div key={i} className="flex min-h-[7rem] flex-col gap-1.5">
            <select
              className="w-full rounded border border-slate-800 bg-slate-950/80 px-1 py-0.5 text-[10px] text-slate-400"
              aria-label={`Chord ${i + 1} degree`}
              value={payload.degrees[i]}
              onChange={(e) => setDegree(i, Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const preview = chordSlotForDegree(payload.keyIndex, payload.mode, d);
                return (
                  <option key={d} value={d}>
                    {preview.roman} — {preview.symbol}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 px-2 py-3 text-center shadow-inner transition hover:border-teal-700/50 hover:from-teal-950/40"
              onClick={() => void playChord(slot.toneNotes)}
            >
              <span className="text-lg font-semibold tracking-tight text-teal-100">{slot.roman}</span>
              <span className="font-mono text-xs text-slate-400">{slot.symbol}</span>
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #3: diatonic triads, pad playback (not Transport). Agent kind{" "}
        <code className="text-slate-400">chord-progression-panel</code>; MIDI is four quarter-note
        triads @ 120 BPM.
      </p>
    </div>
  );
}
