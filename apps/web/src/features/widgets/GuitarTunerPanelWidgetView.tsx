import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import {
  GuitarTunerPanelPayloadSchema,
  GUITAR_TUNING_PRESET_MIDI,
  type GuitarTunerPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function noteLabel(midi: number): string {
  const o = Math.floor(midi / 12) - 1;
  return `${CHROMATIC[((midi % 12) + 12) % 12]}${o}`;
}

function midiToHz(midi: number, refA4: number): number {
  return refA4 * 2 ** ((midi - 69) / 12);
}

function hzToMidi(hz: number, refA4: number): number {
  return 69 + 12 * Math.log2(hz / refA4);
}

function detectFundamentalHz(samples: Float32Array, sampleRate: number): number | null {
  const n = samples.length;
  if (n < 1024) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / n);
  if (rms < 0.0015) return null;

  const minF = 70;
  const maxF = 480;
  const minLag = Math.max(2, Math.floor(sampleRate / maxF));
  const maxLag = Math.min(Math.floor(sampleRate / minF), n - 2);
  if (minLag >= maxLag) return null;

  let bestLag = minLag;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += samples[i] * samples[i + lag];
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = lag;
    }
  }
  const f0 = sampleRate / bestLag;
  if (!Number.isFinite(f0) || f0 < minF || f0 > maxF) return null;
  if (bestCorr < 1e-8) return null;
  return f0;
}

function drawGauge(
  canvas: HTMLCanvasElement,
  cents: number | null,
  active: boolean,
): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgb(15 23 42)";
  g.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.88;
  const r = Math.min(w, h) * 0.72;
  const start = Math.PI * 0.82;
  const span = Math.PI * 0.36;

  g.strokeStyle = "rgb(51 65 85)";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy, r, start, start + span);
  g.stroke();

  const tickCents = [-50, -25, 0, 25, 50];
  for (const c of tickCents) {
    const t = (c + 50) / 100;
    const ang = start + t * span;
    const x1 = cx + Math.cos(ang) * (r - 14);
    const y1 = cy + Math.sin(ang) * (r - 14);
    const x2 = cx + Math.cos(ang) * (r - 2);
    const y2 = cy + Math.sin(ang) * (r - 2);
    g.strokeStyle = c === 0 ? "rgb(251 191 36)" : "rgb(100 116 139)";
    g.lineWidth = c === 0 ? 2 : 1;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  if (active && cents != null && Number.isFinite(cents)) {
    const clamped = Math.max(-50, Math.min(50, cents));
    const t = (clamped + 50) / 100;
    const ang = start + t * span;
    g.strokeStyle =
      Math.abs(clamped) < 3 ? "rgb(52 211 153)" : Math.abs(clamped) < 10 ? "rgb(250 204 21)" : "rgb(248 113 113)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * (r - 20), cy + Math.sin(ang) * (r - 20));
    g.stroke();
    g.fillStyle = g.strokeStyle;
    g.beginPath();
    g.arc(cx + Math.cos(ang) * (r - 20), cy + Math.sin(ang) * (r - 20), 5, 0, Math.PI * 2);
    g.fill();
  }
}

export function GuitarTunerPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => GuitarTunerPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [detectedLabel, setDetectedLabel] = useState<string>("—");
  const [centsDisplay, setCentsDisplay] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const tdRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const centsEmaRef = useRef<number | null>(null);
  const hzEmaRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const midis = GUITAR_TUNING_PRESET_MIDI[payload.tuningPreset];
  const targetMidi = midis[payload.targetStringIndex] ?? midis[0];
  const targetHz = midiToHz(targetMidi, payload.referenceHz);

  const patchData = useCallback(
    (partial: Partial<GuitarTunerPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const stopTuner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    gainRef.current?.disconnect();
    gainRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    tdRef.current = null;
    centsEmaRef.current = null;
    hzEmaRef.current = null;
    setRunning(false);
    setDetectedHz(null);
    setDetectedLabel("—");
    setCentsDisplay(null);
  }, []);

  const playReferenceTone = useCallback(() => {
    const hz = midiToHz(targetMidi, payloadRef.current.referenceHz);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 1.25);
    osc.start(t0);
    osc.stop(t0 + 1.3);
    void ctx.resume();
    osc.onended = () => void ctx.close().catch(() => undefined);
  }, [targetMidi]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const p = payloadRef.current;
    const n = analyser.fftSize;
    let buf = tdRef.current;
    if (!buf || buf.length !== n) {
      buf = new Float32Array<ArrayBuffer>(new ArrayBuffer(n * 4));
      tdRef.current = buf;
    }
    analyser.getFloatTimeDomainData(buf);

    const g = p.inputGain;
    if (g !== 1) {
      for (let i = 0; i < buf.length; i++) buf[i] *= g;
    }

    const sr = analyser.context.sampleRate;
    const hzRaw = detectFundamentalHz(buf, sr);
    const midisList = GUITAR_TUNING_PRESET_MIDI[p.tuningPreset];
    const tgtMidi = midisList[p.targetStringIndex] ?? midisList[0];
    const tgtHz = midiToHz(tgtMidi, p.referenceHz);

    if (hzRaw == null) {
      drawGauge(canvas, centsEmaRef.current, centsEmaRef.current != null);
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const prev = hzEmaRef.current;
    hzEmaRef.current = prev == null ? hzRaw : prev * 0.65 + hzRaw * 0.35;
    const hz = hzEmaRef.current;
    const midi = hzToMidi(hz, p.referenceHz);
    const cents = 1200 * Math.log2(hz / tgtHz);
    const cPrev = centsEmaRef.current;
    centsEmaRef.current = cPrev == null ? cents : cPrev * 0.72 + cents * 0.28;
    setDetectedHz(hz);
    setDetectedLabel(noteLabel(Math.round(midi)));
    setCentsDisplay(centsEmaRef.current);

    drawGauge(canvas, centsEmaRef.current, true);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTuner = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API not available");
      return;
    }
    setError(null);
    stopTuner();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      gainRef.current = gain;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.35;
      analyserRef.current = analyser;
      src.connect(gain);
      gain.connect(analyser);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      analyser.connect(mute);
      mute.connect(ctx.destination);
      await ctx.resume();
      setRunning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Microphone permission denied or unavailable");
      stopTuner();
    }
  }, [stopTuner, tick]);

  useEffect(() => {
    const g = gainRef.current;
    if (g) g.gain.value = payload.inputGain;
  }, [payload.inputGain, running]);

  useEffect(
    () => () => {
      stopTuner();
    },
    [stopTuner],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || running) return;
    drawGauge(c, null, false);
  }, [running]);

  useEffect(() => {
    const syncSize = () => {
      const wrap = canvasRef.current?.parentElement;
      const c = canvasRef.current;
      if (!wrap || !c) return;
      const w = Math.max(160, Math.floor(wrap.clientWidth));
      c.width = w;
      c.height = Math.min(200, Math.floor(w * 0.45));
      drawGauge(c, centsDisplay, running);
    };
    syncSize();
    const wrap = canvasRef.current?.parentElement;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [centsDisplay, running]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      {payload.subtitle ? <p className="text-[11px] text-slate-500">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            type="button"
            className="rounded-lg border border-amber-700/70 bg-amber-950/50 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:border-amber-500"
            onClick={() => void startTuner()}
          >
            Start mic
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
            onClick={stopTuner}
          >
            Stop
          </button>
        )}
        <button
          type="button"
          title="Play reference pitch for the selected string"
          className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-[10px] text-slate-200 hover:border-amber-500/50"
          onClick={() => playReferenceTone()}
        >
          Play ref ({noteLabel(targetMidi)})
        </button>
      </div>

      {error ? <p className="text-[11px] text-amber-400/90">{error}</p> : null}

      <div className="min-h-0 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} className="mx-auto block w-full max-w-md" aria-label="Tuning cents gauge" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Detected</div>
          <div className="font-mono text-lg font-semibold text-slate-100">{detectedLabel}</div>
          <div className="font-mono text-[11px] text-slate-400">
            {detectedHz != null ? `${detectedHz.toFixed(1)} Hz` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Target string</div>
          <div className="font-mono text-lg font-semibold text-amber-200">{noteLabel(targetMidi)}</div>
          <div className="font-mono text-[11px] text-slate-400">{targetHz.toFixed(2)} Hz</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Cents vs target</div>
          <div
            className={`font-mono text-lg font-semibold ${
              centsDisplay == null
                ? "text-slate-500"
                : Math.abs(centsDisplay) < 5
                  ? "text-emerald-400"
                  : Math.abs(centsDisplay) < 15
                    ? "text-amber-300"
                    : "text-rose-300"
            }`}
          >
            {centsDisplay == null ? "—" : `${centsDisplay > 0 ? "+" : ""}${centsDisplay.toFixed(1)} ¢`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {midis.map((m, i) => (
          <button
            key={`${payload.tuningPreset}-${i}`}
            type="button"
            className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${
              i === payload.targetStringIndex
                ? "border-amber-500/70 bg-amber-950/60 text-amber-100"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
            onClick={() => patchData({ targetStringIndex: i })}
          >
            {noteLabel(m)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Tuning preset
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] text-slate-200"
            value={payload.tuningPreset}
            onChange={(e) =>
              patchData({
                tuningPreset: e.target.value as GuitarTunerPanelPayload["tuningPreset"],
                targetStringIndex: Math.min(payload.targetStringIndex, 5),
              })
            }
          >
            <option value="standard">Standard (EADGBE)</option>
            <option value="drop_d">Drop D</option>
            <option value="half_step_down">Half step down</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          A4 reference (Hz)
          <input
            type="number"
            min={415}
            max={466}
            step={0.1}
            className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[11px] text-slate-200"
            value={payload.referenceHz}
            onChange={(e) => patchData({ referenceHz: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 sm:col-span-2">
          Input gain
          <input
            type="range"
            min={50}
            max={400}
            value={Math.round(payload.inputGain * 100)}
            onChange={(e) => patchData({ inputGain: Number(e.target.value) / 100 })}
            className="accent-amber-500"
          />
        </label>
      </div>

      <p className="text-[10px] text-slate-600">
        Kind <code className="text-slate-500">guitar-tuner-panel</code> — mic chromatic tuner with cents vs selected open
        string.
      </p>
    </div>
  );
}
