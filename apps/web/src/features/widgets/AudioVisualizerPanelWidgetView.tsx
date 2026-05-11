import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import {
  AudioVisualizerPanelPayloadSchema,
  type AudioVisualizerPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

function barFill(
  palette: AudioVisualizerPanelPayload["palette"],
  i: number,
  bars: number,
  intensity: number,
): string {
  const p = i / Math.max(1, bars - 1);
  const lift = Math.min(1, intensity) * 18;
  if (palette === "ember") {
    return `hsl(${8 + p * 42} 96% ${48 + lift}%)`;
  }
  if (palette === "ice") {
    return `hsl(${175 + p * 55} 78% ${48 + lift}%)`;
  }
  return `hsl(${275 + p * 75} 95% ${52 + lift}%)`;
}

export function AudioVisualizerPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => AudioVisualizerPanelPayloadSchema.parse(record.data), [record.data]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const stopViz = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    dataRef.current = null;
    setRunning(false);
  }, []);

  const resizeCanvas = useCallback(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    if (!wrap || !c) return;
    const w = Math.max(120, Math.floor(wrap.clientWidth));
    const h = 168;
    c.width = w;
    c.height = h;
  }, []);

  const drawFrame = useCallback(() => {
    const analyser = analyserRef.current;
    const c = canvasRef.current;
    if (!analyser || !c) return;
    const p = payloadRef.current;
    let buf = dataRef.current;
    if (!buf || buf.length !== analyser.frequencyBinCount) {
      buf = new Uint8Array<ArrayBuffer>(new ArrayBuffer(analyser.frequencyBinCount));
      dataRef.current = buf;
    }
    analyser.getByteFrequencyData(buf);

    const g = c.getContext("2d");
    if (!g) return;
    const w = c.width;
    const h = c.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgb(2 6 23)";
    g.fillRect(0, 0, w, h);

    const bars = p.barCount;
    const usable = Math.max(4, Math.floor(buf.length * 0.92));
    const gap = 1;
    const barW = (w - (bars - 1) * gap) / bars;

    for (let i = 0; i < bars; i++) {
      const i0 = Math.floor((i / bars) * usable);
      const i1 = Math.floor(((i + 1) / bars) * usable);
      let peak = 0;
      for (let k = i0; k < i1; k++) peak = Math.max(peak, buf[k] ?? 0);
      const norm = (peak / 255) * p.sensitivity;
      const amp = Math.min(h * 0.96, norm * h * 0.92);
      const x = i * (barW + gap);
      g.fillStyle = barFill(p.palette, i, bars, norm);
      g.fillRect(x, h - amp, Math.max(1, barW), amp);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const startViz = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API not available");
      return;
    }
    setError(null);
    stopViz();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -10;
      const pr = payloadRef.current;
      analyser.smoothingTimeConstant = Math.min(0.99, Math.max(0, pr.smoothing));
      src.connect(analyser);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      analyser.connect(mute);
      mute.connect(ctx.destination);
      analyserRef.current = analyser;
      await ctx.resume();
      resizeCanvas();
      setRunning(true);
      rafRef.current = requestAnimationFrame(drawFrame);
    } catch {
      setError("Microphone permission denied or unavailable");
      stopViz();
    }
  }, [drawFrame, resizeCanvas, stopViz]);

  useEffect(() => {
    const a = analyserRef.current;
    if (a) {
      a.smoothingTimeConstant = Math.min(0.99, Math.max(0, payload.smoothing));
    }
  }, [payload.smoothing]);

  useEffect(() => {
    if (!running) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      resizeCanvas();
      return;
    }
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(el);
    resizeCanvas();
    return () => ro.disconnect();
  }, [running, resizeCanvas]);

  useEffect(
    () => () => {
      stopViz();
    },
    [stopViz],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            type="button"
            className="rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/40 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100 hover:border-fuchsia-500"
            onClick={() => void startViz()}
          >
            Start mic
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
            onClick={stopViz}
          >
            Stop
          </button>
        )}
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          Palette
          <select
            className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200"
            value={payload.palette}
            onChange={(e) =>
              void patchWidgetRecord(record.id, {
                data: { palette: e.target.value as typeof payload.palette },
              })
            }
          >
            <option value="neon">Neon</option>
            <option value="ember">Ember</option>
            <option value="ice">Ice</option>
          </select>
        </label>
      </div>

      <div ref={wrapRef} className="min-h-0 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} className="block w-full" aria-label="Frequency spectrum" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Bars {payload.barCount}
          <input
            type="range"
            min={24}
            max={96}
            step={2}
            value={payload.barCount}
            className="accent-violet-400"
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { barCount: Number(e.target.value) } })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Sensitivity
          <input
            type="range"
            min={0.4}
            max={4}
            step={0.05}
            value={payload.sensitivity}
            className="accent-teal-400"
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { sensitivity: Number(e.target.value) } })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-slate-500">
          Smoothing
          <input
            type="range"
            min={0}
            max={0.99}
            step={0.01}
            value={payload.smoothing}
            className="accent-cyan-400"
            onChange={(e) =>
              void patchWidgetRecord(record.id, { data: { smoothing: Number(e.target.value) } })
            }
          />
        </label>
      </div>

      {error ? <p className="text-[11px] text-amber-400/90">{error}</p> : null}

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #7: mic FFT bars (AnalyserNode). Agent kind{" "}
        <code className="text-slate-400">audio-visualizer-panel</code>.
      </p>
    </div>
  );
}
