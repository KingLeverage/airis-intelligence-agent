import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { LoopRecorderPanelPayloadSchema } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const MAX_RECORD_MS = 90_000;
const MIN_CLIP_BYTES = 400;

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function base64ToObjectUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([Uint8Array.from(bytes)], { type: mime });
  return URL.createObjectURL(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(blob);
  });
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function LoopRecorderPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => LoopRecorderPanelPayloadSchema.parse(record.data), [record.data]);

  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardNextRef = useRef(false);
  const recordStartedAtRef = useRef<number>(0);
  const tickTimerRef = useRef<number | undefined>(undefined);
  const maxTimerRef = useRef<number | undefined>(undefined);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playbackUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const revokePlaybackUrl = useCallback(() => {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    stopPlayback();
    revokePlaybackUrl();
    if (!payload.loopClipBase64 || !payload.loopClipMimeType) return;

    try {
      const url = base64ToObjectUrl(payload.loopClipBase64, payload.loopClipMimeType);
      playbackUrlRef.current = url;
      const el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.src = url;
      audioRef.current = el;
      el.addEventListener("ended", () => setPlaying(false));
    } catch {
      setHint("Could not load saved clip");
    }

    return () => {
      stopPlayback();
      revokePlaybackUrl();
      audioRef.current = null;
    };
  }, [payload.loopClipBase64, payload.loopClipMimeType, revokePlaybackUrl, stopPlayback]);

  const teardownAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    analyserRef.current = null;
    void analyserCtxRef.current?.close().catch(() => undefined);
    analyserCtxRef.current = null;
    const c = canvasRef.current;
    if (c) {
      const g = c.getContext("2d");
      if (g) g.clearRect(0, 0, c.width, c.height);
    }
  }, []);

  const drawMeter = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] ?? 0;
      const avg = sum / buf.length / 255;
      ctx.fillStyle = "rgb(15 23 42)";
      ctx.fillRect(0, 0, w, h);
      const bw = Math.max(4, Math.floor(avg * w));
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgb(45 212 191)");
      grad.addColorStop(1, "rgb(192 132 252)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, bw, h);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const cleanupStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearRecordTimers = useCallback(() => {
    if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
    tickTimerRef.current = undefined;
    if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current);
    maxTimerRef.current = undefined;
  }, []);

  const stopRecorder = useCallback(
    (discard: boolean) => {
      discardNextRef.current = discard;
      clearRecordTimers();
      teardownAnalyser();
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          if (rec.state === "recording") rec.requestData();
          rec.stop();
        } catch {
          cleanupStream();
          mediaRecorderRef.current = null;
          chunksRef.current = [];
          setRecording(false);
          setRecordElapsedMs(0);
        }
      } else {
        cleanupStream();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        setRecording(false);
        setRecordElapsedMs(0);
      }
    },
    [cleanupStream, clearRecordTimers, teardownAnalyser],
  );

  const finalizeBlob = useCallback(
    async (blob: Blob, mime: string) => {
      if (blob.size < MIN_CLIP_BYTES) {
        setHint("Clip too short — try again");
        setRecording(false);
        setRecordElapsedMs(0);
        return;
      }
      try {
        const b64 = await blobToBase64(blob);
        const parsed = LoopRecorderPanelPayloadSchema.safeParse({
          ...payload,
          loopClipBase64: b64,
          loopClipMimeType: mime || blob.type || "audio/webm",
        });
        if (!parsed.success) {
          setHint("Clip too large for widget storage — record a shorter loop");
          setRecording(false);
          setRecordElapsedMs(0);
          return;
        }
        await patchWidgetRecord(record.id, {
          data: {
            loopClipBase64: parsed.data.loopClipBase64,
            loopClipMimeType: parsed.data.loopClipMimeType,
          },
        });
        setHint("Loop saved");
      } catch {
        setHint("Could not save clip");
      }
      setRecording(false);
      setRecordElapsedMs(0);
    },
    [patchWidgetRecord, payload, record.id],
  );

  const startRecording = useCallback(async () => {
    const mime = pickRecorderMime();
    if (!mime) {
      setHint("Recording not supported in this browser");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("Microphone access not available");
      return;
    }

    stopPlayback();
    setHint(null);
    discardNextRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        cleanupStream();
        mediaRecorderRef.current = null;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const type = rec.mimeType || mime;
        if (discardNextRef.current) {
          discardNextRef.current = false;
          setRecording(false);
          setRecordElapsedMs(0);
          return;
        }
        const blob = new Blob(chunks, { type });
        void finalizeBlob(blob, type);
      };

      const ctx = new AudioContext();
      analyserCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      analyser.connect(mute);
      mute.connect(ctx.destination);
      analyserRef.current = analyser;
      void ctx.resume();
      drawMeter();

      recordStartedAtRef.current = Date.now();
      setRecordElapsedMs(0);
      setRecording(true);
      rec.start(120);

      tickTimerRef.current = window.setInterval(() => {
        setRecordElapsedMs(Date.now() - recordStartedAtRef.current);
      }, 200);

      maxTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecorder(false);
        }
      }, MAX_RECORD_MS);
    } catch {
      setHint("Microphone permission denied or unavailable");
      cleanupStream();
      teardownAnalyser();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setRecording(false);
      setRecordElapsedMs(0);
    }
  }, [cleanupStream, drawMeter, finalizeBlob, stopPlayback, stopRecorder, teardownAnalyser]);

  const stopRecording = useCallback(() => {
    stopRecorder(false);
  }, [stopRecorder]);

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el?.src) return;
    try {
      if (playing) {
        el.pause();
        setPlaying(false);
      } else {
        await el.play();
        setPlaying(true);
      }
    } catch {
      setHint("Playback blocked — click Play again");
    }
  }, [playing]);

  const clearClip = useCallback(() => {
    stopPlayback();
    void patchWidgetRecord(record.id, { data: { loopClipBase64: "" } });
    setHint("Clip cleared");
  }, [patchWidgetRecord, record.id, stopPlayback]);

  useEffect(
    () => () => {
      stopRecorder(true);
      teardownAnalyser();
      stopPlayback();
      revokePlaybackUrl();
    },
    [revokePlaybackUrl, stopPlayback, stopRecorder, teardownAnalyser],
  );

  const hasClip = Boolean(payload.loopClipBase64 && payload.loopClipMimeType);
  const unsupported = typeof MediaRecorder === "undefined" || !pickRecorderMime();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      {unsupported ? (
        <p className="text-sm text-amber-400/90">MediaRecorder / codec not supported here.</p>
      ) : null}

      <canvas
        ref={canvasRef}
        width={320}
        height={28}
        className="w-full max-w-full rounded border border-slate-800 bg-slate-950"
        aria-hidden
      />

      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            disabled={unsupported}
            className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:border-rose-600 disabled:opacity-40"
            onClick={() => void startRecording()}
          >
            Record
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
            onClick={stopRecording}
          >
            Stop & save
          </button>
        )}
        <button
          type="button"
          disabled={!hasClip}
          className="rounded-lg border border-teal-900/60 bg-teal-950/40 px-3 py-1.5 text-[11px] font-medium text-teal-100 hover:border-teal-600 disabled:opacity-40"
          onClick={() => void togglePlay()}
        >
          {playing ? "Pause loop" : "Play loop"}
        </button>
        <button
          type="button"
          disabled={!hasClip}
          className="rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 hover:border-slate-500 disabled:opacity-40"
          onClick={clearClip}
        >
          Clear clip
        </button>
        {recording ? (
          <span className="font-mono text-[11px] text-rose-300/90">
            ● {formatMs(recordElapsedMs)} / {formatMs(MAX_RECORD_MS)}
          </span>
        ) : null}
        {hint ? <span className="text-[10px] text-slate-500">{hint}</span> : null}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #4: mic → MediaRecorder → persisted base64; <code className="text-slate-400">Audio</code>{" "}
        with <code className="text-slate-400">loop</code>. Agent kind{" "}
        <code className="text-slate-400">loop-recorder-panel</code>.
      </p>
    </div>
  );
}
