import { z } from "zod";
import { ChatMessageSchema } from "./chat.js";
import { newUuid } from "../utils/ids.js";

export const WidgetKindSchema = z.enum([
  "note",
  "html-card",
  "checklist",
  "stat-ticker",
  "chart-panel",
  "heatmap-panel",
  "timeline-panel",
  "news-feed",
  "metric-grid",
  "lead-finder",
  "research-card",
  "comparison-panel",
  "sequencer-panel",
  "drum-machine-panel",
  "piano-roll-panel",
  "chord-progression-panel",
  "loop-recorder-panel",
  "metronome-panel",
  "synth-keyboard-panel",
  "audio-visualizer-panel",
  "mini-player-panel",
  "karaoke-lyric-panel",
  "guitar-tuner-panel",
  "snake-game-panel",
  "tic-tac-toe-panel",
  "memory-match-panel",
  "puzzle-2048-panel",
  "whack-a-mole-panel",
  "hangman-panel",
  "rock-paper-scissors-panel",
  "connect-four-panel",
  "minesweeper-panel",
  "reaction-time-panel",
  "typing-speed-panel",
  "pong-panel",
  /** Operator-only launcher for allowlisted host CLIs (e.g. Printing Press binaries on PATH). */
  "cli-catalog",
  "airis-agent",
]);

export type WidgetKind = z.infer<typeof WidgetKindSchema>;

export const WidgetStatusSchema = z.enum(["ok", "disabled", "error"]);

export const NotePayloadSchema = z.object({
  content: z.string().default(""),
});

/** Well-known placeholder YouTube ids — never allowed in `html-card` (forces real sourcing). */
const FORBIDDEN_HTML_CARD_YOUTUBE_IDS = ["dQw4w9WgXcQ"] as const;

function findForbiddenYoutubePlaceholder(html: string): string | null {
  const h = html.toLowerCase();
  for (const id of FORBIDDEN_HTML_CARD_YOUTUBE_IDS) {
    if (h.includes(id.toLowerCase())) return id;
  }
  return null;
}

export const HtmlCardPayloadSchema = z
  .object({
    html: z.string().default(""),
    /** Plain fallback if HTML sanitized away */
    plain: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const bad = findForbiddenYoutubePlaceholder(val.html ?? "");
    if (bad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `html_card_forbidden_placeholder_youtube:${bad}`,
        path: ["html"],
      });
    }
  });

export const ChecklistItemSchema = z.object({
  id: z.preprocess(
    (val) => (typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ? val : undefined),
    z.string().uuid().default(() => newUuid())
  ),
  label: z.string(),
  done: z.boolean().default(false),
});

export const ChecklistPayloadSchema = z.object({
  items: z.array(ChecklistItemSchema).default([]),
});

export const StatTickerSymbolSchema = z.object({
  symbol: z.string(),
  price: z.string().optional(),
  changePct: z.number().optional(),
  /** Optional secondary label (e.g. volume) */
  hint: z.string().optional(),
});

export const StatTickerPayloadSchema = z.object({
  symbols: z.array(StatTickerSymbolSchema).default([]),
  subtitle: z.string().optional(),
  trendMode: z.enum(["up", "down", "neutral"]).optional(),
});

const ChartPointSchema = z.object({
  x: z.string(),
  y: z.number(),
  /** Pie (and legend): optional CSS color per slice, e.g. `#f472b6` or `rgb(244,114,182)`. */
  color: z.string().optional(),
});

export const ChartSeriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string().optional(),
  points: z.array(ChartPointSchema).default([]),
});

export const ChartPanelPayloadSchema = z.object({
  chartType: z.enum(["line", "bar", "area", "pie"]).default("line"),
  series: z.array(ChartSeriesSchema).default([]),
  comparisonMode: z.boolean().optional(),
  yLabel: z.string().optional(),
  /** Short line under the widget title — chart context without duplicating the main title. */
  subtitle: z.string().optional(),
});

export type ChartPanelPayload = z.infer<typeof ChartPanelPayloadSchema>;

/** Sparse or dense grid: cell coordinates index into `rowLabels` / `colLabels`. */
export const HeatmapCellSchema = z.object({
  r: z.number().int().nonnegative(),
  c: z.number().int().nonnegative(),
  v: z.number(),
});

export const HeatmapPanelPayloadSchema = z.object({
  rowLabels: z.array(z.string()).default([]),
  colLabels: z.array(z.string()).default([]),
  cells: z.array(HeatmapCellSchema).default([]),
  subtitle: z.string().optional(),
  /** Shown after numeric cell labels (e.g. "%", "k"). */
  valueSuffix: z.string().optional(),
  colorScale: z.enum(["airis", "mono"]).optional(),
});

export const TimelineEventToneSchema = z.enum(["neutral", "risk", "win", "milestone"]);

export const TimelineEventSchema = z.object({
  id: z.string(),
  /** ISO timestamp or compact label (sorted lexicographically for display). */
  at: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  tone: TimelineEventToneSchema.optional(),
});

export const TimelinePanelPayloadSchema = z.object({
  events: z.array(TimelineEventSchema).default([]),
  subtitle: z.string().optional(),
});

export const NewsFeedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string().optional(),
  url: z.string().optional(),
  publishedAt: z.string().optional(),
  summary: z.string().optional(),
});

export const NewsFeedPayloadSchema = z.object({
  items: z.array(NewsFeedItemSchema).default([]),
  maxItems: z.number().int().positive().max(50).optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  showTimestamps: z.boolean().optional(),
});

export const LeadFinderBusinessSchema = z.object({
  name: z.string(),
  rating: z.number().nullable().optional(),
  reviewCount: z.number().int().nullable().optional(),
  category: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
  reviewSnippet: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  hasDirections: z.boolean().optional().default(false),
  audit: z
    .object({
      url: z.string().nullable().optional(),
      finalUrl: z.string().nullable().optional(),
      fetched: z.boolean().optional().default(false),
      statusCode: z.number().int().nullable().optional(),
      sslValid: z.boolean().nullable().optional(),
      responseTimeMs: z.number().nullable().optional(),
      contentBytes: z.number().nullable().optional(),
      techStack: z.array(z.string()).optional().default([]),
      signals: z
        .array(z.object({ id: z.string(), label: z.string(), weight: z.number() }))
        .optional()
        .default([]),
      badnessScore: z.number().min(0).max(100).optional().default(0),
      error: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const LeadFinderPayloadSchema = z.object({
  query: z.string().optional().default(""),
  locationLabel: z.string().optional().default(""),
  scrapedAt: z.string().optional().default(""),
  sourceUrl: z.string().optional().default(""),
  businessCount: z.number().int().optional().default(0),
  websiteFound: z.number().int().optional().default(0),
  noWebsiteCount: z.number().int().optional().default(0),
  auditedCount: z.number().int().optional().default(0),
  avgBadness: z.number().nullable().optional(),
  durationMs: z.number().int().optional().default(0),
  businesses: z.array(LeadFinderBusinessSchema).max(200).optional().default([]),
});

/** Models often emit neutral/stable/mixed; UI only distinguishes up / down / flat. */
function normalizeMetricGridTrend(raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return "flat";
  const k = raw.toLowerCase().trim();
  if (k === "up" || k === "down" || k === "flat") return k;
  const flatish = new Set([
    "neutral",
    "stable",
    "steady",
    "unchanged",
    "sideways",
    "none",
    "n/a",
    "na",
    "mixed",
    "equal",
    "balanced",
    "static",
  ]);
  const upish = new Set([
    "positive",
    "increase",
    "increasing",
    "growing",
    "rising",
    "higher",
    "upward",
    "gain",
  ]);
  const downish = new Set([
    "negative",
    "decrease",
    "decreasing",
    "falling",
    "lower",
    "declining",
    "downward",
    "loss",
  ]);
  if (flatish.has(k)) return "flat";
  if (upish.has(k)) return "up";
  if (downish.has(k)) return "down";
  return "flat";
}

function normalizeMetricGridColumns(raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 2) return 2;
  if (n === 3) return 3;
  return 4;
}

export const MetricGridItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  delta: z.string().optional(),
  trend: z.preprocess(normalizeMetricGridTrend, z.enum(["up", "down", "flat"]).optional()),
});

export const MetricGridPayloadSchema = z.object({
  metrics: z.array(MetricGridItemSchema).default([]),
  columns: z.preprocess(
    normalizeMetricGridColumns,
    z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  ),
});

export type MetricGridPayload = z.infer<typeof MetricGridPayloadSchema>;

export const ResearchCardPayloadSchema = z.object({
  summary: z.string().default(""),
  bullets: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  citations: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});

export const ComparisonPanelEntitySchema = z.object({
  id: z.string(),
  label: z.string(),
  /**
   * Optional HTTPS URL to a portrait (square-ish works best). The UI renders a “cut-out” ring
   * when `headerPortraitStyle` is `cutout` (default when this field is set). Use stable public
   * URLs (e.g. Wikimedia Commons / official press) — the app does not fetch or host images.
   */
  avatarUrl: z.string().optional(),
  metrics: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
});

export const ComparisonPanelPayloadSchema = z.object({
  entities: z.array(ComparisonPanelEntitySchema).default([]),
  highlightDiff: z.boolean().optional(),
  /** Visual treatment for `avatarUrl` in column headers. Default is `cutout` when any entity has `avatarUrl`. */
  headerPortraitStyle: z.enum(["cutout", "circle", "none"]).optional(),
});

export type ComparisonPanelPayload = z.infer<typeof ComparisonPanelPayloadSchema>;

/**
 * Interactive grid sequencer: one row of steps at `bpm` (quarter notes), each step is a 16th note.
 * Trusted renderer only — pattern and tempo are data, not executable code.
 */
export const SequencerPanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    steps: z.number().int().min(4).max(32).default(16),
    bpm: z.number().min(40).max(240).default(120),
    pattern: z.array(z.boolean()).default([]),
  })
  .transform((d) => {
    const n = d.steps;
    let p = [...d.pattern];
    while (p.length < n) p.push(false);
    if (p.length > n) p = p.slice(0, n);
    return { ...d, pattern: p };
  });

export type SequencerPanelPayload = z.infer<typeof SequencerPanelPayloadSchema>;

function normalizePattern16(pattern: boolean[]): boolean[] {
  const p = [...pattern];
  while (p.length < 16) p.push(false);
  return p.slice(0, 16);
}

/** 2×16 kick/snare machine; audio is rendered by the trusted web component (Tone.js). */
export const DrumMachinePanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    bpm: z.number().min(60).max(200).default(120),
    /** Shuffle amount 0–100 (maps to Tone.Transport.swing). */
    swing: z.number().min(0).max(100).default(18),
    kickPattern: z.array(z.boolean()).default([]),
    snarePattern: z.array(z.boolean()).default([]),
  })
  .transform((d) => ({
    ...d,
    kickPattern: normalizePattern16(d.kickPattern),
    snarePattern: normalizePattern16(d.snarePattern),
  }));

export type DrumMachinePanelPayload = z.infer<typeof DrumMachinePanelPayloadSchema>;

export const PianoRollWaveformSchema = z.enum(["sine", "square", "sawtooth", "triangle"]);

/** 12 pitch rows (C4→B4) × 16 steps; `grid[row][step]` row 0 = C4, row 11 = B4. */
export const PianoRollPanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    bpm: z.number().min(40).max(240).default(120),
    waveform: PianoRollWaveformSchema.default("triangle"),
    attack: z.number().min(0.001).max(2).default(0.02),
    decay: z.number().min(0).max(2).default(0.12),
    sustain: z.number().min(0).max(1).default(0.35),
    release: z.number().min(0.001).max(3).default(0.25),
    grid: z.array(z.array(z.boolean())).default([]),
  })
  .transform((d) => {
    const ROWS = 12;
    const COLS = 16;
    let g = d.grid.map((r) => [...r]);
    while (g.length < ROWS) g.push([]);
    g = g.slice(0, ROWS).map((row) => {
      const r = [...row];
      while (r.length < COLS) r.push(false);
      return r.slice(0, COLS);
    });
    return { ...d, grid: g };
  });

export type PianoRollPanelPayload = z.infer<typeof PianoRollPanelPayloadSchema>;

export const ChordProgressionModeSchema = z.enum(["major", "natural_minor"]);

const ChordDegreeSchema = z.number().int().min(1).max(7);

export const ChordProgressionPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  keyIndex: z.number().int().min(0).max(11).default(0),
  mode: ChordProgressionModeSchema.default("major"),
  degrees: z
    .tuple([ChordDegreeSchema, ChordDegreeSchema, ChordDegreeSchema, ChordDegreeSchema])
    .default([1, 5, 6, 4]),
});

export type ChordProgressionPanelPayload = z.infer<typeof ChordProgressionPanelPayloadSchema>;

/** ~7.5 MB base64 cap keeps widget JSON bounded; prefer short loops. */
const LOOP_CLIP_BASE64_MAX = 7_500_000;

export const LoopRecorderPanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    /** Raw base64 (no `data:…;base64,` prefix). */
    loopClipBase64: z.string().max(LOOP_CLIP_BASE64_MAX).optional(),
    /** e.g. `audio/webm;codecs=opus` from `MediaRecorder`. */
    loopClipMimeType: z.string().max(160).optional(),
  })
  .transform((d) => {
    const has = Boolean(d.loopClipBase64 && d.loopClipBase64.length > 0);
    return {
      ...d,
      loopClipBase64: has ? d.loopClipBase64 : undefined,
      loopClipMimeType: has ? d.loopClipMimeType : undefined,
    };
  })
  .superRefine((val, ctx) => {
    const has = Boolean(val.loopClipBase64);
    if (has && !val.loopClipMimeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "loop_recorder_clip_requires_mime",
        path: ["loopClipMimeType"],
      });
    }
    if (!has && val.loopClipMimeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "loop_recorder_mime_without_clip",
        path: ["loopClipMimeType"],
      });
    }
  });

export type LoopRecorderPanelPayload = z.infer<typeof LoopRecorderPanelPayloadSchema>;

export const MetronomePanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  bpm: z.number().min(30).max(280).default(120),
  /** Beats per bar (quarter-note grid); downbeat is beat 1. */
  beatsPerBar: z.number().int().min(1).max(12).default(4),
  accentDownbeat: z.boolean().default(true),
});

export type MetronomePanelPayload = z.infer<typeof MetronomePanelPayloadSchema>;

/** One or two chromatic octaves from root C; same oscillator types as piano-roll. */
export const SynthKeyboardPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Scientific octave of the lowest C (e.g. 4 → C4…B4 for span 1). */
  rootMidiOctave: z.number().int().min(2).max(6).default(4),
  spanOctaves: z.number().int().min(1).max(2).default(1),
  waveform: PianoRollWaveformSchema.default("triangle"),
  attack: z.number().min(0.001).max(2).default(0.02),
  decay: z.number().min(0).max(2).default(0.1),
  sustain: z.number().min(0).max(1).default(0.35),
  release: z.number().min(0.001).max(3).default(0.25),
  volumeDb: z.number().min(-36).max(6).default(-10),
});

export type SynthKeyboardPanelPayload = z.infer<typeof SynthKeyboardPanelPayloadSchema>;

export const AudioVisualizerPaletteSchema = z.enum(["neon", "ember", "ice"]);

export const AudioVisualizerPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Number of frequency bars drawn (FFT buckets are downsampled). */
  barCount: z.number().int().min(24).max(96).default(56),
  /** Vertical gain multiplier (mic levels vary by device). */
  sensitivity: z.number().min(0.4).max(4).default(1.25),
  /** AnalyserNode smoothing (0 = jumpy, ~0.9 = very smooth). */
  smoothing: z.number().min(0).max(0.99).default(0.82),
  palette: AudioVisualizerPaletteSchema.default("neon"),
});

export type AudioVisualizerPanelPayload = z.infer<typeof AudioVisualizerPanelPayloadSchema>;

/** Streamable demo MP3s (SoundHelix); agents may replace `tracks` with real URLs. */
export const DEFAULT_MINI_PLAYER_TRACKS: ReadonlyArray<{
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}> = [
  {
    id: "sh-1",
    title: "SoundHelix Song 1",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "sh-2",
    title: "SoundHelix Song 2",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "sh-3",
    title: "SoundHelix Song 3",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
];

export const MiniPlayerTrackSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    artist: z.string(),
    /** Remote streamable URL (HTTPS). */
    audioUrl: z.string().url().optional(),
    /** User-uploaded clip persisted in widget JSON (use modest file sizes). */
    audioBase64: z.string().optional(),
    mime: z.string().min(1).optional(),
    coverUrl: z.string().url().optional(),
    /** Embedded art from uploads (e.g. ID3 APIC), persisted with the track. */
    coverBase64: z.string().optional(),
    coverMime: z.string().min(1).optional(),
  })
  .superRefine((t, ctx) => {
    const hasUrl = Boolean(t.audioUrl);
    const hasEmbedded = Boolean(t.audioBase64 && t.mime);
    if (hasUrl && hasEmbedded) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mini_player_track_url_xor_embedded",
        path: ["audioUrl"],
      });
    }
    if (!hasUrl && !hasEmbedded) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mini_player_track_needs_url_or_embedded",
        path: ["audioUrl"],
      });
    }
    const hasCoverHttp = Boolean(t.coverUrl);
    const hasCoverEmbedded = Boolean(t.coverBase64 && t.coverMime);
    if (t.coverBase64 && !t.coverMime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mini_player_cover_mime_required_with_base64",
        path: ["coverMime"],
      });
    }
    if (t.coverMime && !t.coverBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mini_player_cover_base64_required_with_mime",
        path: ["coverBase64"],
      });
    }
    if (hasCoverHttp && hasCoverEmbedded) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mini_player_cover_url_xor_embedded",
        path: ["coverUrl"],
      });
    }
  });

export type MiniPlayerTrack = z.infer<typeof MiniPlayerTrackSchema>;

export const MiniPlayerRepeatModeSchema = z.enum(["off", "all", "one"]);

export const MiniPlayerPanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    tracks: z
      .array(MiniPlayerTrackSchema)
      .min(1)
      .default(() => [...DEFAULT_MINI_PLAYER_TRACKS]),
    currentIndex: z.number().int().min(0).default(0),
    volume: z.number().min(0).max(1).default(0.85),
    repeatMode: MiniPlayerRepeatModeSchema.default("off"),
    shuffle: z.boolean().default(false),
  })
  .transform((d) => ({
    ...d,
    currentIndex: d.tracks.length === 0 ? 0 : Math.min(d.currentIndex, d.tracks.length - 1),
  }));

export type MiniPlayerPanelPayload = z.infer<typeof MiniPlayerPanelPayloadSchema>;

export const DEFAULT_KARAOKE_AUDIO_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

/** Demo cue sheet; agents should replace with real `lines` + `audioUrl`. */
export const DEFAULT_KARAOKE_LINES: ReadonlyArray<{ startSec: number; text: string }> = [
  { startSec: 0, text: "Welcome — this line follows the backing track clock" },
  { startSec: 14, text: "Set each line's startSec to match your song" },
  { startSec: 28, text: "The active line glows; click a line to jump the playhead" },
  { startSec: 42, text: "Turn off backing track for rehearsal-only stepping" },
];

export const KaraokeLyricLineSchema = z.object({
  /** Cue time in seconds (sorted on parse). */
  startSec: z.number().min(0),
  text: z.string(),
});

export type KaraokeLyricLine = z.infer<typeof KaraokeLyricLineSchema>;

export const KaraokeLyricPanelPayloadSchema = z
  .object({
    subtitle: z.string().optional(),
    songTitle: z.string().optional(),
    artist: z.string().optional(),
    /** When false, hide audio and step lyrics with arrows (rehearsal). */
    useBackingTrack: z.boolean().default(true),
    audioUrl: z.string().url().default(DEFAULT_KARAOKE_AUDIO_URL),
    volume: z.number().min(0).max(1).default(0.85),
    lines: z.array(KaraokeLyricLineSchema).min(1).default(() => [...DEFAULT_KARAOKE_LINES]),
    /** Highlight index when `useBackingTrack` is false. */
    rehearsalLineIndex: z.number().int().min(0).default(0),
  })
  .transform((d) => {
    const lines = [...d.lines].sort((a, b) => a.startSec - b.startSec);
    const maxI = Math.max(0, lines.length - 1);
    return {
      ...d,
      lines,
      rehearsalLineIndex: Math.min(d.rehearsalLineIndex, maxI),
    };
  });

export type KaraokeLyricPanelPayload = z.infer<typeof KaraokeLyricPanelPayloadSchema>;

/** Open-string MIDI notes (low → high) for common guitar layouts. */
export const GUITAR_TUNING_PRESET_MIDI: Readonly<
  Record<"standard" | "drop_d" | "half_step_down", readonly number[]>
> = {
  standard: [40, 45, 50, 55, 59, 64],
  drop_d: [38, 45, 50, 55, 59, 64],
  half_step_down: [39, 44, 49, 54, 58, 63],
};

export const GuitarTuningPresetSchema = z.enum(["standard", "drop_d", "half_step_down"]);

export const GuitarTunerPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** A4 reference (Hz). */
  referenceHz: z.number().min(415).max(466).default(440),
  tuningPreset: GuitarTuningPresetSchema.default("standard"),
  /** 0 = lowest string in the preset. */
  targetStringIndex: z.number().int().min(0).max(5).default(0),
  /** Boost quiet input (time-domain scaling before pitch estimate). */
  inputGain: z.number().min(0.5).max(4).default(1.35),
});

export type GuitarTunerPanelPayload = z.infer<typeof GuitarTunerPanelPayloadSchema>;

export const SnakeGamePanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Persisted high score for this widget. */
  bestScore: z.number().int().min(0).default(0),
});

export type SnakeGamePanelPayload = z.infer<typeof SnakeGamePanelPayloadSchema>;

export const TicTacToePanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  winsVsAi: z.number().int().min(0).default(0),
  lossesVsAi: z.number().int().min(0).default(0),
  drawsVsAi: z.number().int().min(0).default(0),
});

export type TicTacToePanelPayload = z.infer<typeof TicTacToePanelPayloadSchema>;

export const MemoryMatchPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  gamesWon: z.number().int().min(0).default(0),
  /** Fewest moves to clear all pairs (one move = flip two cards); 0 = no record yet. */
  bestMoves: z.number().int().min(0).default(0),
});

export type MemoryMatchPanelPayload = z.infer<typeof MemoryMatchPanelPayloadSchema>;

export const Puzzle2048PanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Highest total score achieved in any finished or in-progress session (sum of merge values). */
  bestScore: z.number().int().min(0).default(0),
});

export type Puzzle2048PanelPayload = z.infer<typeof Puzzle2048PanelPayloadSchema>;

export const WhackAMolePanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Most moles whacked in a single 30s round. */
  bestScore: z.number().int().min(0).default(0),
});

export type WhackAMolePanelPayload = z.infer<typeof WhackAMolePanelPayloadSchema>;

export const HangmanPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  gamesWon: z.number().int().min(0).default(0),
  gamesLost: z.number().int().min(0).default(0),
});

export type HangmanPanelPayload = z.infer<typeof HangmanPanelPayloadSchema>;

export const RockPaperScissorsPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  winsVsAi: z.number().int().min(0).default(0),
  lossesVsAi: z.number().int().min(0).default(0),
  drawsVsAi: z.number().int().min(0).default(0),
});

export type RockPaperScissorsPanelPayload = z.infer<typeof RockPaperScissorsPanelPayloadSchema>;

export const ConnectFourPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  winsVsAi: z.number().int().min(0).default(0),
  lossesVsAi: z.number().int().min(0).default(0),
  drawsVsAi: z.number().int().min(0).default(0),
});

export type ConnectFourPanelPayload = z.infer<typeof ConnectFourPanelPayloadSchema>;

export const MinesweeperPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  gamesWon: z.number().int().min(0).default(0),
  gamesLost: z.number().int().min(0).default(0),
});

export type MinesweeperPanelPayload = z.infer<typeof MinesweeperPanelPayloadSchema>;

export const ReactionTimePanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Fastest valid reaction in milliseconds (0 = no record yet). */
  bestReactionMs: z.number().int().min(0).default(0),
});

export type ReactionTimePanelPayload = z.infer<typeof ReactionTimePanelPayloadSchema>;

export const TypingSpeedPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  /** Best gross WPM from a completed run (0 = none yet). */
  bestWpm: z.number().int().min(0).default(0),
});

export type TypingSpeedPanelPayload = z.infer<typeof TypingSpeedPanelPayloadSchema>;

export const PongPanelPayloadSchema = z.object({
  subtitle: z.string().optional(),
  playerWins: z.number().int().min(0).default(0),
  aiWins: z.number().int().min(0).default(0),
});

export type PongPanelPayload = z.infer<typeof PongPanelPayloadSchema>;

export const CliCatalogRunEntrySchema = z.object({
  /** Preset `toolKey`, or `custom:…` for operator argv runs. */
  toolKey: z.string().min(1).max(140),
  /** Full command line for display (preset or custom). */
  commandLine: z.string().max(2000).optional(),
  /** Server-rendered readable summary (JSON expanded to prose-style bullets when applicable). */
  readableSummary: z.string().max(56_000).optional(),
  ranAt: z.string().min(1).max(80),
  exitCode: z.number().int(),
  ok: z.boolean(),
  durationMs: z.number().nonnegative(),
  stdout: z.string().max(32_000).optional(),
  stderr: z.string().max(8_000).optional(),
});

export type CliCatalogRunEntry = z.infer<typeof CliCatalogRunEntrySchema>;

export const CliCatalogPayloadSchema = z.object({
  /** Persisted run log (newest first). */
  recentRuns: z.array(CliCatalogRunEntrySchema).max(15).default([]),
  /**
   * When set (e.g. from Pre-Set Widgets → CLI catalog flyout), the panel only shows this family’s
   * presets and custom argv for that CLI. Must match server catalog `familyId` (e.g. `coingecko`).
   */
  cliFamilyId: z.string().min(1).max(48).optional(),
  /**
   * Bundled upstream `SKILL.md` bodies (Printing Press library) for operator reference in-widget.
   * Filled server-side on create when absent.
   */
  bundledSkillMarkdown: z.string().max(130_000).optional(),
});

export type CliCatalogPayload = z.infer<typeof CliCatalogPayloadSchema>;

export const AirisAgentPayloadSchema = z.object({
  sessionId: z.string().uuid().default(() => newUuid()),
  systemPrompt: z.string().optional(),
  messages: z.array(ChatMessageSchema).default([]),
  agentStatus: z.enum(["idle", "streaming", "error"]).default("idle"),
  lastError: z.string().nullish(),
  /** Guard against nested agent-spawn loops; max 2. */
  spawnDepth: z.number().int().min(0).max(2).default(0),
});

export type AirisAgentPayload = z.infer<typeof AirisAgentPayloadSchema>;

export const WidgetSizePresetSchema = z.enum(["sm", "md", "lg", "xl", "wide", "tall"]);

export const WidgetThemeVariantSchema = z.enum(["glass", "midnight", "contrast"]);

export const WidgetDataSourceConfigSchema = z.object({
  key: z.string().optional(),
  refreshIntervalMs: z.number().int().positive().optional(),
});

export type WidgetDataSourceConfig = z.infer<typeof WidgetDataSourceConfigSchema>;

export const WidgetRenderConfigSchema = z
  .object({
    variant: z.enum(["default", "compact"]).optional(),
    collapsed: z.boolean().optional(),
    sizePreset: WidgetSizePresetSchema.optional(),
    themeVariant: WidgetThemeVariantSchema.optional(),
    displayMode: z.string().optional(),
    /** Reserved for a future constrained render DSL — must not execute arbitrary code. */
    structuredRenderId: z.string().optional(),
  })
  .passthrough();

/** Layout embedded on each widget (source of truth for this phase). */
export const WidgetLayoutPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export type WidgetLayoutPosition = z.infer<typeof WidgetLayoutPositionSchema>;

/** Default when API creates a widget without layout — sized for readable content, not a 3-row strip. */
export const DEFAULT_WIDGET_LAYOUT: WidgetLayoutPosition = { x: 0, y: 0, w: 12, h: 10 };

export const WidgetRecordSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  kind: WidgetKindSchema,
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().nonnegative(),
  data: z.record(z.unknown()),
  /** Persisted with the widget; drives workspace placement. */
  layout: WidgetLayoutPositionSchema.default(DEFAULT_WIDGET_LAYOUT),
  renderConfig: WidgetRenderConfigSchema.optional(),
  status: WidgetStatusSchema.default("ok"),
  lastError: z.string().optional(),
  /** Optional lineage / agent instruction trace (not shown as primary content). */
  authoringNote: z.string().optional(),
  /** Declarative refresh hint — actual fetching is future work. */
  dataSource: WidgetDataSourceConfigSchema.optional(),
});

export type WidgetRecord = z.infer<typeof WidgetRecordSchema>;

/** Compatibility/clarity aliases for the widget runtime contract. */
export const WidgetLayoutSchema = WidgetLayoutPositionSchema;
export const WidgetRendererSchema = WidgetRenderConfigSchema;
export const WidgetStyleVariantSchema = WidgetThemeVariantSchema;
export const WidgetDataSourceSchema = WidgetDataSourceConfigSchema;

const BaseWidgetFields = WidgetRecordSchema.omit({ kind: true, data: true });

export const NoteWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("note"),
  data: NotePayloadSchema,
});

export const HtmlCardWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("html-card"),
  data: HtmlCardPayloadSchema,
});

export const ChecklistWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("checklist"),
  data: ChecklistPayloadSchema,
});

export const StatTickerWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("stat-ticker"),
  data: StatTickerPayloadSchema,
});

export const ChartPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("chart-panel"),
  data: ChartPanelPayloadSchema,
});

export const HeatmapPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("heatmap-panel"),
  data: HeatmapPanelPayloadSchema,
});

export const TimelinePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("timeline-panel"),
  data: TimelinePanelPayloadSchema,
});

export const NewsFeedWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("news-feed"),
  data: NewsFeedPayloadSchema,
});

export const MetricGridWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("metric-grid"),
  data: MetricGridPayloadSchema,
});

export const LeadFinderWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("lead-finder"),
  data: LeadFinderPayloadSchema,
});

export const ResearchCardWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("research-card"),
  data: ResearchCardPayloadSchema,
});

export const ComparisonPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("comparison-panel"),
  data: ComparisonPanelPayloadSchema,
});

export const SequencerPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("sequencer-panel"),
  data: SequencerPanelPayloadSchema,
});

export const DrumMachinePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("drum-machine-panel"),
  data: DrumMachinePanelPayloadSchema,
});

export const PianoRollPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("piano-roll-panel"),
  data: PianoRollPanelPayloadSchema,
});

export const ChordProgressionPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("chord-progression-panel"),
  data: ChordProgressionPanelPayloadSchema,
});

export const LoopRecorderPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("loop-recorder-panel"),
  data: LoopRecorderPanelPayloadSchema,
});

export const MetronomePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("metronome-panel"),
  data: MetronomePanelPayloadSchema,
});

export const SynthKeyboardPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("synth-keyboard-panel"),
  data: SynthKeyboardPanelPayloadSchema,
});

export const AudioVisualizerPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("audio-visualizer-panel"),
  data: AudioVisualizerPanelPayloadSchema,
});

export const MiniPlayerPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("mini-player-panel"),
  data: MiniPlayerPanelPayloadSchema,
});

export const KaraokeLyricPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("karaoke-lyric-panel"),
  data: KaraokeLyricPanelPayloadSchema,
});

export const GuitarTunerPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("guitar-tuner-panel"),
  data: GuitarTunerPanelPayloadSchema,
});

export const SnakeGamePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("snake-game-panel"),
  data: SnakeGamePanelPayloadSchema,
});

export const TicTacToePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("tic-tac-toe-panel"),
  data: TicTacToePanelPayloadSchema,
});

export const MemoryMatchPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("memory-match-panel"),
  data: MemoryMatchPanelPayloadSchema,
});

export const Puzzle2048PanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("puzzle-2048-panel"),
  data: Puzzle2048PanelPayloadSchema,
});

export const WhackAMolePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("whack-a-mole-panel"),
  data: WhackAMolePanelPayloadSchema,
});

export const HangmanPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("hangman-panel"),
  data: HangmanPanelPayloadSchema,
});

export const RockPaperScissorsPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("rock-paper-scissors-panel"),
  data: RockPaperScissorsPanelPayloadSchema,
});

export const ConnectFourPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("connect-four-panel"),
  data: ConnectFourPanelPayloadSchema,
});

export const MinesweeperPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("minesweeper-panel"),
  data: MinesweeperPanelPayloadSchema,
});

export const ReactionTimePanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("reaction-time-panel"),
  data: ReactionTimePanelPayloadSchema,
});

export const TypingSpeedPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("typing-speed-panel"),
  data: TypingSpeedPanelPayloadSchema,
});

export const PongPanelWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("pong-panel"),
  data: PongPanelPayloadSchema,
});

export const CliCatalogWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("cli-catalog"),
  data: CliCatalogPayloadSchema,
});

export const AirisAgentWidgetSchema = BaseWidgetFields.extend({
  kind: z.literal("airis-agent"),
  data: AirisAgentPayloadSchema,
});

export const BaseWidgetSchema = WidgetRecordSchema;

export const AnyWidgetSchema = z.discriminatedUnion("kind", [
  NoteWidgetSchema,
  HtmlCardWidgetSchema,
  ChecklistWidgetSchema,
  StatTickerWidgetSchema,
  ChartPanelWidgetSchema,
  HeatmapPanelWidgetSchema,
  TimelinePanelWidgetSchema,
  NewsFeedWidgetSchema,
  MetricGridWidgetSchema,
  LeadFinderWidgetSchema,
  ResearchCardWidgetSchema,
  ComparisonPanelWidgetSchema,
  SequencerPanelWidgetSchema,
  DrumMachinePanelWidgetSchema,
  PianoRollPanelWidgetSchema,
  ChordProgressionPanelWidgetSchema,
  LoopRecorderPanelWidgetSchema,
  MetronomePanelWidgetSchema,
  SynthKeyboardPanelWidgetSchema,
  AudioVisualizerPanelWidgetSchema,
  MiniPlayerPanelWidgetSchema,
  KaraokeLyricPanelWidgetSchema,
  GuitarTunerPanelWidgetSchema,
  SnakeGamePanelWidgetSchema,
  TicTacToePanelWidgetSchema,
  MemoryMatchPanelWidgetSchema,
  Puzzle2048PanelWidgetSchema,
  WhackAMolePanelWidgetSchema,
  HangmanPanelWidgetSchema,
  RockPaperScissorsPanelWidgetSchema,
  ConnectFourPanelWidgetSchema,
  MinesweeperPanelWidgetSchema,
  ReactionTimePanelWidgetSchema,
  TypingSpeedPanelWidgetSchema,
  PongPanelWidgetSchema,
  CliCatalogWidgetSchema,
  AirisAgentWidgetSchema,
]);

export type BaseWidget = z.infer<typeof BaseWidgetSchema>;
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;
export type WidgetRenderer = z.infer<typeof WidgetRendererSchema>;
export type AnyWidget = z.infer<typeof AnyWidgetSchema>;

export type WidgetFactoryInput = {
  kind: WidgetKind;
  title?: string;
  data?: Record<string, unknown>;
  layout?: WidgetLayoutPosition;
  renderConfig?: z.infer<typeof WidgetRenderConfigSchema>;
  dataSource?: WidgetDataSourceConfig;
  authoringNote?: string;
};

/** Server returns these when a widget file cannot be loaded (other widgets still load). */
export const WidgetLoadWarningSchema = z.object({
  file: z.string(),
  widgetId: z.string().optional(),
  code: z.string(),
  message: z.string(),
});

export type WidgetLoadWarning = z.infer<typeof WidgetLoadWarningSchema>;
