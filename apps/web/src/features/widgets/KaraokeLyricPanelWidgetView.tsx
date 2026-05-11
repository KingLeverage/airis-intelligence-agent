import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import {
  KaraokeLyricPanelPayloadSchema,
  type KaraokeLyricPanelPayload,
} from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function lineIndexAtTime(lines: readonly { startSec: number }[], t: number): number {
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startSec <= t) idx = i;
    else break;
  }
  return idx;
}

export function KaraokeLyricPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => KaraokeLyricPanelPayloadSchema.parse(record.data), [record.data]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const scrubbingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const patchData = useCallback(
    (partial: Partial<KaraokeLyricPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const activeLineIndex = useMemo(() => {
    if (!payload.useBackingTrack) return payload.rehearsalLineIndex;
    return lineIndexAtTime(payload.lines, currentTime);
  }, [payload.useBackingTrack, payload.rehearsalLineIndex, payload.lines, currentTime]);

  useEffect(() => {
    const el = lineRefs.current.get(activeLineIndex);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLineIndex]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = payload.volume;
  }, [payload.volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !payload.useBackingTrack) return;
    setLoadError(null);
    if (a.src !== payload.audioUrl) {
      a.src = payload.audioUrl;
      a.load();
    }
  }, [payload.audioUrl, payload.useBackingTrack]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || payload.useBackingTrack) return;
    a.pause();
    setPlaying(false);
  }, [payload.useBackingTrack]);

  const stepRehearsal = useCallback(
    (delta: number) => {
      const max = Math.max(0, payload.lines.length - 1);
      const next = Math.min(max, Math.max(0, payload.rehearsalLineIndex + delta));
      if (next !== payload.rehearsalLineIndex) patchData({ rehearsalLineIndex: next });
    },
    [patchData, payload.lines.length, payload.rehearsalLineIndex],
  );

  const onSeekBarPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const a = audioRef.current;
      const dur = duration;
      if (!a || !dur || !payload.useBackingTrack) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
      a.currentTime = (x / rect.width) * dur;
      setCurrentTime(a.currentTime);
    },
    [duration, payload.useBackingTrack],
  );

  const seekToLineIndex = useCallback(
    (i: number) => {
      const line = payload.lines[i];
      if (!line) return;
      if (!payload.useBackingTrack) {
        patchData({ rehearsalLineIndex: i });
        return;
      }
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = line.startSec;
      setCurrentTime(line.startSec);
      void a.play().catch(() => setLoadError("Playback blocked"));
    },
    [patchData, payload.lines, payload.useBackingTrack],
  );

  const togglePlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a || !payload.useBackingTrack) return;
    if (playing) a.pause();
    else {
      try {
        await a.play();
        setLoadError(null);
      } catch {
        setLoadError("Playback blocked or unavailable");
      }
    }
  }, [payload.useBackingTrack, playing]);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && t !== root && !root.contains(t)) return;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        stepRehearsal(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        stepRehearsal(1);
      } else if (e.key === " " && payload.useBackingTrack) {
        if (t instanceof HTMLInputElement || t instanceof HTMLButtonElement) return;
        e.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepRehearsal, togglePlay, payload.useBackingTrack]);

  const setLineRef = useCallback((i: number, el: HTMLButtonElement | null) => {
    if (el) lineRefs.current.set(i, el);
    else lineRefs.current.delete(i);
  }, []);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className="flex h-full min-h-0 flex-col gap-2 rounded-lg p-2 outline-none ring-violet-500/30 focus-visible:ring-2"
    >
      {payload.subtitle ? (
        <p className="text-[11px] text-slate-500">{payload.subtitle}</p>
      ) : null}

      {(payload.songTitle || payload.artist) && (
        <div className="text-center">
          {payload.songTitle ? (
            <div className="text-sm font-semibold text-slate-100">{payload.songTitle}</div>
          ) : null}
          {payload.artist ? <div className="text-[11px] text-slate-400">{payload.artist}</div> : null}
        </div>
      )}

      {payload.useBackingTrack ? (
        <>
          <audio
            ref={audioRef}
            className="hidden"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              if (!scrubbingRef.current) setCurrentTime(e.currentTarget.currentTime);
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onError={() => setLoadError("Could not load audio")}
          />
          {loadError ? <p className="text-[11px] text-amber-400/90">{loadError}</p> : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-full border border-violet-500/50 bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
              onClick={() => void togglePlay()}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <span className="font-mono text-[10px] text-slate-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
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
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-violet-500/90"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <label className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="w-8 shrink-0">Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(payload.volume * 100)}
              onChange={(e) => patchData({ volume: Number(e.target.value) / 100 })}
              className="h-1 flex-1 accent-violet-500"
            />
          </label>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
            onClick={() => stepRehearsal(-1)}
          >
            ◀ Line
          </button>
          <span className="text-slate-500">Rehearsal</span>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
            onClick={() => stepRehearsal(1)}
          >
            Line ▶
          </button>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-500">
        <input
          type="checkbox"
          checked={payload.useBackingTrack}
          onChange={(e) => patchData({ useBackingTrack: e.target.checked })}
          className="accent-violet-500"
        />
        Backing track (sync lyrics to audio)
      </label>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/50 p-2">
        {payload.lines.map((line, i) => {
          const active = i === activeLineIndex;
          return (
            <button
              key={`${line.startSec}-${i}`}
              ref={(el) => setLineRef(i, el)}
              type="button"
              onClick={() => seekToLineIndex(i)}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                active
                  ? "bg-violet-600/25 text-lg font-semibold text-violet-100 ring-1 ring-violet-500/50"
                  : "text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <span className="mr-2 font-mono text-[10px] text-slate-600">{formatTime(line.startSec)}</span>
              {line.text}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-600">
        Focus panel: arrows step lines · Space plays/pauses with backing track. Kind{" "}
        <code className="text-slate-500">karaoke-lyric-panel</code>.
      </p>
    </div>
  );
}
