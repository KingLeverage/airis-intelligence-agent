import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import {
  MiniPlayerPanelPayloadSchema,
  type MiniPlayerPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";
import { extractEmbeddedCoverFromFile } from "./extractEmbeddedCover";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 48) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 38%) 0%, hsl(${h2} 65% 22%) 100%)`;
}

function base64ToObjectUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || "audio/mpeg" });
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

/** Keep uploads small so widget PATCH bodies stay reasonable. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const VIZ_BARS = 48;

type MiniVizGraph = {
  ctx: AudioContext;
  analyser: AnalyserNode;
};

function drawMiniVizFrame(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  buf: Uint8Array<ArrayBuffer>,
  isPlaying: boolean,
): void {
  analyser.getByteFrequencyData(buf);
  const g = canvas.getContext("2d");
  if (!g) return;
  const dpr = window.devicePixelRatio || 1;
  const lw = canvas.width / dpr;
  const lh = canvas.height / dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, lw, lh);

  const damp = isPlaying ? 1 : 0.28;
  const usable = Math.max(8, Math.floor(buf.length * 0.88));
  const gap = 1;
  const barW = (lw - (VIZ_BARS - 1) * gap) / VIZ_BARS;

  for (let i = 0; i < VIZ_BARS; i++) {
    const i0 = Math.floor((i / VIZ_BARS) * usable);
    const i1 = Math.floor(((i + 1) / VIZ_BARS) * usable);
    let peak = 0;
    for (let k = i0; k < i1; k++) peak = Math.max(peak, buf[k] ?? 0);
    const norm = (peak / 255) * damp;
    const amp = Math.min(lh * 0.58, norm * lh * 0.52);
    const x = i * (barW + gap);
    const hue = 145 + (i / VIZ_BARS) * 55;
    g.fillStyle = `hsla(${hue} 88% 56% / ${0.14 + norm * 0.62})`;
    g.fillRect(x, lh - amp, Math.max(1, barW), amp);
  }
}

export function MiniPlayerPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => MiniPlayerPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeAfterTrackChangeRef = useRef(false);
  const scrubbingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const vizGraphRef = useRef<MiniVizGraph | null>(null);
  const vizBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const vizRafRef = useRef(0);
  const playingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  playbackUrlRef.current = playbackUrl;
  /** Local override while dragging; cleared when the widget record reloads from the server. */
  const [sliderVolume, setSliderVolume] = useState<number | null>(null);
  const [vizAnalyser, setVizAnalyser] = useState<AnalyserNode | null>(null);
  const displayVolume = sliderVolume ?? payload.volume;
  const volumeApplyRef = useRef(displayVolume);
  volumeApplyRef.current = displayVolume;
  playingRef.current = playing;

  const track = payload.tracks[payload.currentIndex] ?? payload.tracks[0];

  const coverSrc = useMemo(() => {
    if (!track) return null;
    if (track.coverUrl) return { src: track.coverUrl } as const;
    if (track.coverBase64 && track.coverMime)
      return { src: `data:${track.coverMime};base64,${track.coverBase64}` } as const;
    return null;
  }, [track]);

  useEffect(() => {
    setSliderVolume(null);
  }, [record.updatedAt]);

  useEffect(() => {
    setArtFailed(false);
  }, [track?.id, track?.coverUrl, track?.coverBase64]);

  const patchData = useCallback(
    (partial: Partial<MiniPlayerPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const resizeVizCanvas = useCallback(() => {
    const wrap = viewportRef.current;
    const c = vizCanvasRef.current;
    if (!wrap || !c) return;
    const dpr = window.devicePixelRatio || 1;
    const lw = Math.max(80, Math.floor(wrap.clientWidth));
    const lh = Math.max(120, Math.floor(wrap.clientHeight));
    c.width = Math.floor(lw * dpr);
    c.height = Math.floor(lh * dpr);
    c.style.width = `${lw}px`;
    c.style.height = `${lh}px`;
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = Math.min(1, Math.max(0, displayVolume));
  }, [displayVolume]);

  useEffect(() => {
    if (!track) {
      setPlaybackUrl(null);
      return;
    }
    if (track.audioUrl) {
      setPlaybackUrl(track.audioUrl);
      return;
    }
    if (track.audioBase64 && track.mime) {
      const u = base64ToObjectUrl(track.audioBase64, track.mime);
      setPlaybackUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setPlaybackUrl(null);
  }, [track?.id, track?.audioUrl, track?.audioBase64, track?.mime]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !playbackUrl) return;
    setLoadError(null);
    a.src = playbackUrl;
    a.load();
    a.volume = Math.min(1, Math.max(0, volumeApplyRef.current));
    if (resumeAfterTrackChangeRef.current) {
      resumeAfterTrackChangeRef.current = false;
      void a.play().catch(() => setLoadError("Playback failed"));
    }
  }, [playbackUrl]);

  /** Route decoded audio through an analyser so the canvas can react (remote URLs need CORS). */
  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    const url = playbackUrlRef.current;
    if (!audio || !url || vizGraphRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        if (cancelled) {
          void ctx.close();
          return;
        }
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        analyser.minDecibels = -92;
        analyser.maxDecibels = -22;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        if (cancelled) {
          src.disconnect();
          analyser.disconnect();
          void ctx.close();
          return;
        }
        vizGraphRef.current = { ctx, analyser };
        if (cancelled) {
          vizGraphRef.current = null;
          src.disconnect();
          analyser.disconnect();
          void ctx.close();
          return;
        }
        setVizAnalyser(analyser);
      } catch {
        /* Remote streams without CORS often fail; playback continues via the element. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing]);

  useEffect(() => {
    const analyser = vizAnalyser;
    const c = vizCanvasRef.current;
    const vp = viewportRef.current;
    if (!analyser || !c || !vp) return;
    resizeVizCanvas();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => resizeVizCanvas());
      ro.observe(vp);
    }
    const tick = () => {
      const g = vizGraphRef.current;
      const canvas = vizCanvasRef.current;
      if (!g || !canvas) return;
      let buf = vizBufRef.current;
      if (!buf || buf.length !== g.analyser.frequencyBinCount) {
        buf = new Uint8Array(new ArrayBuffer(g.analyser.frequencyBinCount));
        vizBufRef.current = buf;
      }
      drawMiniVizFrame(g.analyser, canvas, buf, playingRef.current);
      vizRafRef.current = requestAnimationFrame(tick);
    };
    vizRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (vizRafRef.current) cancelAnimationFrame(vizRafRef.current);
      ro?.disconnect();
    };
  }, [vizAnalyser, resizeVizCanvas]);

  useEffect(
    () => () => {
      if (vizRafRef.current) cancelAnimationFrame(vizRafRef.current);
      vizRafRef.current = 0;
      vizBufRef.current = null;
      const g = vizGraphRef.current;
      vizGraphRef.current = null;
      if (g) void g.ctx.close();
    },
    [],
  );

  const onPickLocalFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const list = Array.from(files);
      const valid = list.filter((f) => f.size <= MAX_UPLOAD_BYTES);
      if (valid.length === 0) {
        setLoadError(`Each file must be under ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB (large clips may also fail to save).`);
        return;
      }
      if (valid.length < list.length) {
        setLoadError(`${list.length - valid.length} file(s) skipped (over ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`);
      } else {
        setLoadError(null);
      }
      try {
        let tracks = [...payloadRef.current.tracks];
        let lastIndex = payloadRef.current.currentIndex;
        for (const file of valid) {
          const mime = file.type && file.type.startsWith("audio/") ? file.type : "audio/mpeg";
          const audioBase64 = await blobToBase64(file);
          const embedded = await extractEmbeddedCoverFromFile(file);
          const stem = file.name.replace(/\.[^/.]+$/, "") || "Track";
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          tracks = [
            ...tracks,
            {
              id,
              title: stem,
              artist: "Local file",
              audioBase64,
              mime,
              ...(embedded
                ? { coverBase64: embedded.coverBase64, coverMime: embedded.coverMime }
                : {}),
            },
          ];
          lastIndex = tracks.length - 1;
        }
        await patchWidgetRecord(record.id, { data: { tracks, currentIndex: lastIndex } });
        resumeAfterTrackChangeRef.current = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("413") || /payload too large|body.*limit/i.test(msg)) {
          setLoadError("Save failed: file is too large for the server limit. Try a shorter clip or use an HTTPS audio URL.");
        } else if (/fetch|network|failed to fetch/i.test(msg)) {
          setLoadError("Could not save track (network error). Check that the API is running.");
        } else {
          setLoadError(msg.includes("read_failed") ? "Could not read audio file(s)." : `Could not save: ${msg}`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [patchWidgetRecord, record.id],
  );

  const handleEnded = useCallback(() => {
    const p = payloadRef.current;
    const n = p.tracks.length;
    if (n === 0) return;
    if (p.repeatMode === "one") {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        void a.play().catch(() => undefined);
      }
      return;
    }
    let next: number;
    if (p.shuffle && n > 1) {
      next = p.currentIndex;
      while (next === p.currentIndex) next = Math.floor(Math.random() * n);
    } else {
      next = p.currentIndex + 1;
      if (next >= n) {
        if (p.repeatMode === "all") next = 0;
        else {
          setPlaying(false);
          return;
        }
      }
    }
    resumeAfterTrackChangeRef.current = true;
    patchData({ currentIndex: next });
  }, [patchData]);

  const togglePlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      try {
        await a.play();
        setLoadError(null);
      } catch {
        setLoadError("Playback blocked or unavailable");
      }
    }
  }, [playing]);

  const goPrev = useCallback(() => {
    const p = payloadRef.current;
    const a = audioRef.current;
    const n = p.tracks.length;
    if (n === 0 || !a) return;
    if (a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    let prev = p.currentIndex - 1;
    if (prev < 0) prev = p.repeatMode === "all" ? n - 1 : p.currentIndex;
    if (prev === p.currentIndex) {
      a.currentTime = 0;
      return;
    }
    resumeAfterTrackChangeRef.current = playing;
    patchData({ currentIndex: prev });
  }, [patchData, playing]);

  const goNext = useCallback(() => {
    const p = payloadRef.current;
    const n = p.tracks.length;
    if (n === 0) return;
    let next: number;
    if (p.shuffle && n > 1) {
      next = p.currentIndex;
      while (next === p.currentIndex) next = Math.floor(Math.random() * n);
    } else {
      next = p.currentIndex + 1;
      if (next >= n) {
        if (p.repeatMode === "all") next = 0;
        else return;
      }
    }
    resumeAfterTrackChangeRef.current = playing;
    patchData({ currentIndex: next });
  }, [patchData, playing]);

  const cycleRepeat = useCallback(() => {
    const order: MiniPlayerPanelPayload["repeatMode"][] = ["off", "all", "one"];
    const i = Math.max(0, order.indexOf(payload.repeatMode));
    patchData({ repeatMode: order[(i + 1) % order.length] });
  }, [patchData, payload.repeatMode]);

  const onSeekBarPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const a = audioRef.current;
      const dur = duration;
      if (!a || !dur) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
      a.currentTime = (x / rect.width) * dur;
      setCurrentTime(a.currentTime);
    },
    [duration],
  );

  const repeatTitle =
    payload.repeatMode === "off"
      ? "Repeat off"
      : payload.repeatMode === "all"
        ? "Repeat queue"
        : "Repeat one track";

  if (!track) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-[11px] text-slate-500">
        No tracks in playlist.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <audio
        ref={audioRef}
        className="hidden"
        playsInline
        crossOrigin={track.audioUrl ? "anonymous" : undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={(e) => {
          if (!scrubbingRef.current) setCurrentTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onError={() => setLoadError("Could not load audio")}
      />

      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      <div
        ref={viewportRef}
        className="relative min-h-[168px] flex-1 overflow-hidden rounded-xl border border-emerald-900/40 shadow-inner"
      >
        <div className="pointer-events-none absolute inset-0 bg-slate-950" aria-hidden />
        {!coverSrc || artFailed ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: coverGradient(track.id + track.title) }}
            aria-hidden
          />
        ) : (
          <img
            src={coverSrc.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setArtFailed(true)}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40"
          aria-hidden
        />
        <canvas
          ref={vizCanvasRef}
          className={`absolute inset-0 h-full w-full pointer-events-none mix-blend-screen ${vizAnalyser ? "opacity-95" : "opacity-0"}`}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/55 to-transparent px-3 pt-14 pb-2.5">
          <div className="truncate text-sm font-semibold tracking-tight text-white drop-shadow-md">{track.title}</div>
          <div className="truncate text-[11px] text-emerald-100/90 drop-shadow">{track.artist}</div>
          <div className="text-[10px] tabular-nums text-slate-400">
            {payload.currentIndex + 1} / {payload.tracks.length}
          </div>
        </div>
      </div>

      {loadError ? <p className="text-[11px] text-amber-400/90">{loadError}</p> : null}

      <div
        className="relative h-2 cursor-pointer rounded-full bg-slate-800"
        onPointerDown={(e) => {
          scrubbingRef.current = true;
          onSeekBarPointer(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!scrubbingRef.current) return;
          onSeekBarPointer(e);
        }}
        onPointerUp={(e) => {
          scrubbingRef.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onPointerCancel={() => {
          scrubbingRef.current = false;
        }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-emerald-500/90"
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          title="Shuffle"
          className={`rounded-lg border px-2.5 py-1.5 text-sm ${
            payload.shuffle
              ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-200"
              : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600"
          }`}
          onClick={() => patchData({ shuffle: !payload.shuffle })}
        >
          🔀
        </button>
        <button
          type="button"
          title="Previous"
          className="rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-600"
          onClick={goPrev}
        >
          ⏮
        </button>
        <button
          type="button"
          title={playing ? "Pause" : "Play"}
          className="rounded-full border border-emerald-500/60 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500"
          onClick={() => void togglePlay()}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          title="Next"
          className="rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-600"
          onClick={goNext}
        >
          ⏭
        </button>
        <button
          type="button"
          title={repeatTitle}
          className={`rounded-lg border px-2.5 py-1.5 text-sm ${
            payload.repeatMode !== "off"
              ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-200"
              : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600"
          }`}
          onClick={cycleRepeat}
        >
          {payload.repeatMode === "one" ? "🔂" : "🔁"}
        </button>
      </div>

      <label className="flex min-h-9 cursor-pointer items-center gap-2 py-1 text-[10px] text-slate-500">
        <span className="w-10 shrink-0">Vol</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(displayVolume * 100)}
          onInput={(e) => {
            const v = Number((e.target as HTMLInputElement).value) / 100;
            setSliderVolume(v);
            const a = audioRef.current;
            if (a) a.volume = Math.min(1, Math.max(0, v));
          }}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            void patchWidgetRecord(record.id, { data: { volume: v } });
          }}
          className="h-2 flex-1 accent-emerald-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.webm"
          multiple
          className="hidden"
          onChange={(e) => void onPickLocalFiles(e.target.files)}
        />
        <button
          type="button"
          className="rounded-lg border border-emerald-800/70 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-medium text-emerald-100 hover:border-emerald-500/60"
          onClick={() => fileInputRef.current?.click()}
        >
          Add local audio…
        </button>
        <span className="text-[10px] text-slate-500">Saved in this widget (12 MB max per file)</span>
      </div>

      <p className="text-[10px] text-slate-600">
        Remote tracks: <code className="text-slate-500">audioUrl</code> + optional <code className="text-slate-500">coverUrl</code>. Uploads:{" "}
        <code className="text-slate-500">audioBase64</code> + <code className="text-slate-500">mime</code>; MP3 embedded art is saved as{" "}
        <code className="text-slate-500">coverBase64</code> + <code className="text-slate-500">coverMime</code>. Kind{" "}
        <code className="text-slate-500">mini-player-panel</code>.
      </p>
    </div>
  );
}
