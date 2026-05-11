import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { WidgetRecord } from "@airis/shared";
import { MetronomePanelPayloadSchema } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

function disposeClick(s: Tone.MembraneSynth | null) {
  s?.dispose();
}

/** Shared `Tone.Transport` — same contract as drum / piano widgets. */
export function MetronomePanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => MetronomePanelPayloadSchema.parse(record.data), [record.data]);

  const [playing, setPlaying] = useState(false);
  const [beatInBar, setBeatInBar] = useState(1);
  const [flash, setFlash] = useState(false);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const clickRef = useRef<Tone.MembraneSynth | null>(null);
  const repeatIdRef = useRef<number | null>(null);
  const beatCounterRef = useRef(0);
  const flashTimerRef = useRef<number | undefined>(undefined);

  const applyTransportSettings = useCallback(() => {
    Tone.Transport.bpm.value = payloadRef.current.bpm;
    Tone.Transport.swing = 0;
  }, []);

  const stopPlayback = useCallback(() => {
    if (repeatIdRef.current != null) {
      Tone.Transport.clear(repeatIdRef.current);
      repeatIdRef.current = null;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    beatCounterRef.current = 0;
    setBeatInBar(1);
    setFlash(false);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = undefined;
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    if (!clickRef.current) {
      clickRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.006,
        octaves: 3,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.065, sustain: 0, release: 0.04 },
      }).toDestination();
      clickRef.current.volume.value = -8;
    }

    stopPlayback();
    applyTransportSettings();
    setPlaying(true);

    const id = Tone.Transport.scheduleRepeat((time) => {
      const p = payloadRef.current;
      const i = beatCounterRef.current % p.beatsPerBar;
      const beat = i + 1;
      const isDown = i === 0;
      const note = p.accentDownbeat && isDown ? "C5" : "G4";
      const vel = p.accentDownbeat && isDown ? 0.92 : 0.62;
      clickRef.current?.triggerAttackRelease(note, "32n", time, vel);
      Tone.Draw.schedule(() => {
        setBeatInBar(beat);
        setFlash(true);
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlash(false), 110);
      }, time);
      beatCounterRef.current += 1;
    }, "4n");

    repeatIdRef.current = id;
    Tone.Transport.start();
  }, [applyTransportSettings, stopPlayback]);

  useEffect(() => {
    if (!playing) return;
    applyTransportSettings();
  }, [playing, applyTransportSettings, payload.bpm]);

  useEffect(
    () => () => {
      stopPlayback();
      disposeClick(clickRef.current);
      clickRef.current = null;
    },
    [stopPlayback],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[10px] text-slate-500">
          <span>
            BPM <span className="font-mono text-slate-400">{payload.bpm}</span>
          </span>
          <input
            type="range"
            min={30}
            max={280}
            value={payload.bpm}
            className="w-full accent-teal-400"
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { bpm: Number(e.target.value) } })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Beats / bar
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] text-slate-200"
            value={payload.beatsPerBar}
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { beatsPerBar: Number(e.target.value) } })
            }
          >
            {Array.from({ length: 12 }, (_, n) => n + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-400">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={payload.accentDownbeat}
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { accentDownbeat: e.target.checked } })
            }
          />
          Accent beat 1
        </label>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
        <div
          className="relative flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-full border-4 transition-[transform,box-shadow,border-color] duration-[100ms] ease-out"
          style={{
            transform: flash ? "scale(1.12)" : "scale(1)",
            borderColor: beatInBar === 1 && flash ? "rgb(45 212 191)" : "rgb(71 85 105)",
            boxShadow: flash
              ? beatInBar === 1
                ? "0 0 32px rgba(45,212,191,0.5)"
                : "0 0 22px rgba(148,163,184,0.35)"
              : "none",
          }}
        >
          <span className="font-mono text-3xl font-semibold tabular-nums text-teal-100">
            {beatInBar}
          </span>
          <span className="text-[11px] text-slate-500">/ {payload.beatsPerBar}</span>
        </div>

        <div className="flex gap-2">
          {!playing ? (
            <button
              type="button"
              className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-4 py-2 text-[12px] font-semibold text-teal-100 hover:border-teal-500"
              onClick={() => void startPlayback()}
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-[12px] font-semibold text-slate-100 hover:bg-slate-700"
              onClick={stopPlayback}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #5: quarter-note clicks + beat ring. Agent kind{" "}
        <code className="text-slate-400">metronome-panel</code>; uses shared{" "}
        <code className="text-slate-400">Tone.Transport</code>.
      </p>
    </div>
  );
}
