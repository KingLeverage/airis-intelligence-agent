import { z } from "zod";
import { buildWidgetIntelligencePromptSection } from "./widget-intelligence/prompt-section.js";
import {
  AirisAgentPayloadSchema,
  ChartPanelPayloadSchema,
  ChecklistPayloadSchema,
  ComparisonPanelPayloadSchema,
  HeatmapPanelPayloadSchema,
  HtmlCardPayloadSchema,
  MetricGridPayloadSchema,
  NewsFeedPayloadSchema,
  LeadFinderPayloadSchema,
  NotePayloadSchema,
  ResearchCardPayloadSchema,
  DrumMachinePanelPayloadSchema,
  PianoRollPanelPayloadSchema,
  ChordProgressionPanelPayloadSchema,
  LoopRecorderPanelPayloadSchema,
  MetronomePanelPayloadSchema,
  SynthKeyboardPanelPayloadSchema,
  AudioVisualizerPanelPayloadSchema,
  MiniPlayerPanelPayloadSchema,
  KaraokeLyricPanelPayloadSchema,
  GuitarTunerPanelPayloadSchema,
  SnakeGamePanelPayloadSchema,
  TicTacToePanelPayloadSchema,
  MemoryMatchPanelPayloadSchema,
  Puzzle2048PanelPayloadSchema,
  WhackAMolePanelPayloadSchema,
  HangmanPanelPayloadSchema,
  RockPaperScissorsPanelPayloadSchema,
  ConnectFourPanelPayloadSchema,
  MinesweeperPanelPayloadSchema,
  ReactionTimePanelPayloadSchema,
  TypingSpeedPanelPayloadSchema,
  PongPanelPayloadSchema,
  CliCatalogPayloadSchema,
  SequencerPanelPayloadSchema,
  StatTickerPayloadSchema,
  TimelinePanelPayloadSchema,
  type WidgetKind,
} from "./schemas/widget.js";
import { WIDGET_KINDS } from "./constants/widgetKinds.js";

/** Single place to register widget kinds for prompts, validation, and UI discovery. */
export const WIDGET_KIND_DEFS = {
  note: {
    kind: "note" as const,
    label: "Note",
    tier: 1 as const,
    description: "Plain text note; payload uses { content: string }.",
    payloadSchema: NotePayloadSchema,
    examplePayload: { content: "Hello from the agent" },
  },
  "html-card": {
    kind: "html-card" as const,
    label: "HTML card",
    tier: 1 as const,
    description:
      "Small HTML fragment; payload { html?, plain? }. **YouTube:** every `embed/VIDEO_ID` and `watch?v=VIDEO_ID` must be **real** — copy ids from Browser JSON after `browser.navigate`, the user message, or `research-card` citations. **Never** fabricate embeds, **never** add “example / demonstration only” disclaimers when the user asked for real media. Known placeholder ids are **rejected** server-side.",
    payloadSchema: HtmlCardPayloadSchema,
    examplePayload: { html: "<p><strong>AIRIS</strong></p>" },
  },
  checklist: {
    kind: "checklist" as const,
    label: "Checklist",
    tier: 1 as const,
    description: "Todo list; payload uses { items: [{ id: uuid, label, done }] }.",
    payloadSchema: ChecklistPayloadSchema,
    examplePayload: {
      items: [{ id: "00000000-0000-4000-8000-000000000001", label: "Task", done: false }],
    },
  },
  "stat-ticker": {
    kind: "stat-ticker" as const,
    label: "Stat ticker",
    tier: 2 as const,
    description:
      "Horizontal tape; payload { symbols: [{ symbol, price?, changePct? }], subtitle?, trendMode? }.",
    payloadSchema: StatTickerPayloadSchema,
    examplePayload: {
      symbols: [
        { symbol: "BTC", price: "98,200", changePct: 0.4 },
        { symbol: "ETH", price: "3,420", changePct: -0.2 },
      ],
      trendMode: "neutral",
    },
  },
  "chart-panel": {
    kind: "chart-panel" as const,
    label: "Chart panel",
    tier: 2 as const,
    description:
      "Series chart; payload { chartType: line|bar|area|pie, series: [{ id, label, color?, points:[{x,y,color?}]}], comparisonMode?, yLabel? }. **Pie:** first series only — each point is a slice (x = label, y = weight). Optional **per-slice** `points[].color` (hex/rgb); else palette order. **Bigger chart:** resize the widget grid (layout w/h) — the pie SVG scales with the panel. **PDF:** \`export.pdf\` sections may set \`chartWidgetId\` to this widget’s \`id\` to embed a server-rasterized chart image in the PDF.",
    payloadSchema: ChartPanelPayloadSchema,
    examplePayload: {
      chartType: "line",
      comparisonMode: true,
      series: [
        {
          id: "a",
          label: "A",
          points: [
            { x: "Mon", y: 1 },
            { x: "Tue", y: 3 },
          ],
        },
      ],
    },
  },
  "heatmap-panel": {
    kind: "heatmap-panel" as const,
    label: "Heatmap panel",
    tier: 2 as const,
    description:
      "Matrix heatmap; payload { rowLabels: string[], colLabels: string[], cells: [{ r, c, v }], subtitle?, valueSuffix?, colorScale?: 'airis'|'mono' }. Each cell (r,c) indexes labels; `v` drives color intensity.",
    payloadSchema: HeatmapPanelPayloadSchema,
    examplePayload: {
      subtitle: "Exposure by region × signal",
      rowLabels: ["NA", "EU", "APAC"],
      colLabels: ["Latency", "Churn", "Cost"],
      cells: [
        { r: 0, c: 0, v: 0.35 },
        { r: 0, c: 1, v: 0.72 },
        { r: 1, c: 0, v: 0.5 },
      ],
      colorScale: "airis",
    },
  },
  "timeline-panel": {
    kind: "timeline-panel" as const,
    label: "Timeline panel",
    tier: 2 as const,
    description:
      "Vertical milestone stream; payload { events: [{ id, at, title, detail?, tone?: 'neutral'|'risk'|'win'|'milestone' }], subtitle? }. Prefer ISO `at` for true chronology.",
    payloadSchema: TimelinePanelPayloadSchema,
    examplePayload: {
      subtitle: "Program milestones",
      events: [
        { id: "e1", at: "2026-01-10", title: "Kickoff", tone: "milestone" },
        { id: "e2", at: "2026-02-02", title: "Risk review", tone: "risk", detail: "Vendor SLA drift" },
      ],
    },
  },
  "news-feed": {
    kind: "news-feed" as const,
    label: "News feed",
    tier: 2 as const,
    description:
      "Headlines; payload { items: [{ id, title, source?, url?, publishedAt?, summary? }], maxItems?, category? }.",
    payloadSchema: NewsFeedPayloadSchema,
    examplePayload: {
      items: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "Sample headline",
          source: "TechWire",
        },
      ],
      maxItems: 8,
      category: "ai",
    },
  },
  "metric-grid": {
    kind: "metric-grid" as const,
    label: "Metric grid",
    tier: 2 as const,
    description:
      "KPI tiles; payload { metrics: [{ id, label, value, delta?, trend? }], columns?: 2|3|4 }. **PDF:** \`export.pdf\` \`chartWidgetId\` may reference this widget’s \`id\` to embed a server-rasterized tile grid.",
    payloadSchema: MetricGridPayloadSchema,
    examplePayload: {
      columns: 4,
      metrics: [
        { id: "00000000-0000-4000-8000-000000000003", label: "ARR", value: "$1.2M", trend: "up" },
      ],
    },
  },
  "lead-finder": {
    kind: "lead-finder" as const,
    label: "Lead finder",
    tier: 2 as const,
    description:
      "Sortable lead spreadsheet from Google Maps + website badness audit. Payload { query, businesses:[{name,rating,reviewCount,phone,address,website,audit:{badnessScore,signals,techStack}}], counts, avgBadness }. Created/updated by POST /api/spaces/:spaceId/lead-finder/run. CSV download via GET /api/spaces/:spaceId/lead-finder/:widgetId/csv.",
    payloadSchema: LeadFinderPayloadSchema,
    examplePayload: { query: "plumber in Boise ID", businesses: [] },
  },
  "research-card": {
    kind: "research-card" as const,
    label: "Research card",
    tier: 2 as const,
    description:
      "Synthesis; payload { summary, bullets?, tags?, citations?:[{ label, url? }] }.",
    payloadSchema: ResearchCardPayloadSchema,
    examplePayload: {
      summary: "Key finding in one paragraph.",
      bullets: ["Insight A", "Insight B"],
      tags: ["market", "risk"],
    },
  },
  "comparison-panel": {
    kind: "comparison-panel" as const,
    label: "Comparison panel",
    tier: 2 as const,
    description:
      "Side-by-side metrics; payload { entities: [{ id, label, avatarUrl?, metrics:[{key,value}]}], highlightDiff?, headerPortraitStyle?: 'cutout'|'circle'|'none' }. Use **https** `avatarUrl` only (e.g. Wikimedia Commons file URLs from research). AIRIS does not scrape or host images — the model supplies URLs after browsing. **PDF:** \`export.pdf\` \`chartWidgetId\` may embed a **text-only comparison table** (avatars are not fetched server-side).",
    payloadSchema: ComparisonPanelPayloadSchema,
    examplePayload: {
      highlightDiff: true,
      headerPortraitStyle: "cutout",
      entities: [
        {
          id: "x",
          label: "Option A",
          avatarUrl:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Wikipedia_logo_EN.png/120px-Wikipedia_logo_EN.png",
          metrics: [
            { key: "Latency", value: "40ms" },
            { key: "Cost", value: "$9" },
          ],
        },
        {
          id: "y",
          label: "Option B",
          metrics: [
            { key: "Latency", value: "52ms" },
            { key: "Cost", value: "$6" },
          ],
        },
      ],
    },
  },
  "sequencer-panel": {
    kind: "sequencer-panel" as const,
    label: "Step sequencer",
    tier: 3 as const,
    description:
      "Interactive rhythmic grid: payload { steps?: 4–32 (default 16), bpm?: 40–240, pattern?: boolean[] (length normalized to steps), subtitle? }. Each step is one 16th-note at the given BPM; the workspace renderer plays short tones for active steps. Use `widget.create` with kind `sequencer-panel` and optional payload to pre-fill a beat.",
    payloadSchema: SequencerPanelPayloadSchema,
    examplePayload: {
      steps: 16,
      bpm: 128,
      pattern: [
        true,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
      subtitle: "16-step line — tweak pattern and BPM in the UI",
    },
  },
  "drum-machine-panel": {
    kind: "drum-machine-panel" as const,
    label: "Drum machine",
    tier: 3 as const,
    description:
      "2×16 kick/snare machine with Tone.js: payload { bpm?: 60–200, swing?: 0–100, kickPattern?: boolean[16], snarePattern?: boolean[16], subtitle? }. Trusted React renderer; patterns persist. Agent: `widget.create` kind `drum-machine-panel`.",
    payloadSchema: DrumMachinePanelPayloadSchema,
    examplePayload: {
      bpm: 128,
      swing: 22,
      kickPattern: [
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
      ],
      snarePattern: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
      subtitle: "Neon 2-row — Play for audio",
    },
  },
  "piano-roll-panel": {
    kind: "piano-roll-panel" as const,
    label: "Piano roll",
    tier: 3 as const,
    description:
      "1-octave (C4–B4) × 16-step piano roll with Tone.PolySynth: payload { bpm?, waveform?: sine|square|sawtooth|triangle, attack/decay/sustain/release?, grid?: boolean[12][16] (row 0=C4 … row 11=B4, cols=steps), subtitle? }. Click cells to toggle; Play schedules 16th notes. Agent: `widget.create` kind `piano-roll-panel`.",
    payloadSchema: PianoRollPanelPayloadSchema,
    examplePayload: {
      bpm: 110,
      waveform: "triangle",
      attack: 0.02,
      decay: 0.1,
      sustain: 0.4,
      release: 0.2,
      grid: Array.from({ length: 12 }, (_, r) =>
        Array.from({ length: 16 }, (_, c) => (r === 0 && c % 4 === 0) || (r === 4 && c % 2 === 0)),
      ),
      subtitle: "Sparse demo pattern — paint your melody",
    },
  },
  "chord-progression-panel": {
    kind: "chord-progression-panel" as const,
    label: "Chord progression",
    tier: 3 as const,
    description:
      "Diatonic triad pad player + MIDI export: payload { keyIndex?: 0–11 (default 0=C), mode?: major|natural_minor, degrees?: [d1,d2,d3,d4] each 1–7 (scale degrees), subtitle? }. Four chord buttons (roman + symbol); click to hear; Randomize picks a preset row; Copy MIDI exports type-0 SMF (four triads × 1 quarter @ 120 BPM). Agent: `widget.create` kind `chord-progression-panel`.",
    payloadSchema: ChordProgressionPanelPayloadSchema,
    examplePayload: {
      keyIndex: 0,
      mode: "major",
      degrees: [1, 5, 6, 4],
      subtitle: "I–V–vi–IV in C",
    },
  },
  "loop-recorder-panel": {
    kind: "loop-recorder-panel" as const,
    label: "Loop recorder",
    tier: 3 as const,
    description:
      "Browser mic capture via MediaRecorder; loop playback with HTMLAudioElement. Payload { subtitle?, loopClipBase64?, loopClipMimeType? } — clip is raw base64 (no data URL prefix) + MIME from the recorder (e.g. audio/webm;codecs=opus). Max encoded length ~7.5M chars; keep takes short. Clear by sending empty `loopClipBase64`. Agent: `widget.create` kind `loop-recorder-panel`.",
    payloadSchema: LoopRecorderPanelPayloadSchema,
    examplePayload: {
      subtitle: "Record a phrase; it loops until you stop or clear",
    },
  },
  "metronome-panel": {
    kind: "metronome-panel" as const,
    label: "Metronome",
    tier: 3 as const,
    description:
      "Tone.js quarter-note metronome on shared Transport: payload { bpm?: 30–280, beatsPerBar?: 1–12 (default 4), accentDownbeat?: boolean (default true), subtitle? }. Start/Stop; downbeat click is louder/higher when accent is on. Large beat ring pulses each quarter. Agent: `widget.create` kind `metronome-panel`.",
    payloadSchema: MetronomePanelPayloadSchema,
    examplePayload: {
      bpm: 100,
      beatsPerBar: 4,
      accentDownbeat: true,
      subtitle: "4/4 — Transport shared with other music widgets",
    },
  },
  "synth-keyboard-panel": {
    kind: "synth-keyboard-panel" as const,
    label: "Synth keyboard",
    tier: 3 as const,
    description:
      "Playable piano-style keys with Tone.PolySynth (not Transport): payload { rootMidiOctave?: 2–6 (C of lowest octave, default 4), spanOctaves?: 1|2, waveform?: sine|square|sawtooth|triangle, attack/decay/sustain/release?, volumeDb?, subtitle? }. Pointer press/release; agent: `widget.create` kind `synth-keyboard-panel`.",
    payloadSchema: SynthKeyboardPanelPayloadSchema,
    examplePayload: {
      rootMidiOctave: 4,
      spanOctaves: 1,
      waveform: "triangle",
      attack: 0.02,
      decay: 0.12,
      sustain: 0.4,
      release: 0.22,
      volumeDb: -10,
      subtitle: "C4–B4 one octave",
    },
  },
  "audio-visualizer-panel": {
    kind: "audio-visualizer-panel" as const,
    label: "Audio visualizer",
    tier: 3 as const,
    description:
      "Live mic spectrum bars (Web Audio AnalyserNode + canvas): payload { subtitle?, barCount?: 24–96, sensitivity?: 0.4–4, smoothing?: 0–0.99, palette?: neon|ember|ice }. Start/Stop capture; settings persist. Agent: `widget.create` kind `audio-visualizer-panel`.",
    payloadSchema: AudioVisualizerPanelPayloadSchema,
    examplePayload: {
      barCount: 56,
      sensitivity: 1.25,
      smoothing: 0.82,
      palette: "neon",
      subtitle: "Allow microphone when prompted",
    },
  },
  "mini-player-panel": {
    kind: "mini-player-panel" as const,
    label: "Mini player",
    tier: 3 as const,
    description:
      "Spotify-style HTML5 audio player: payload { subtitle?, tracks?: [{ id, title, artist, audioUrl?, audioBase64?, mime?, coverUrl?, coverBase64?+coverMime? (embedded art, not with coverUrl) }] — each track needs **either** `audioUrl` (HTTPS) **or** `audioBase64`+`mime` (user upload); currentIndex?, volume?: 0–1, repeatMode?: off|all|one, shuffle?: boolean }. UI can add local files (persisted as base64; keep files small). Agent: `widget.create` kind `mini-player-panel`.",
    payloadSchema: MiniPlayerPanelPayloadSchema,
    examplePayload: {
      subtitle: "Demo playlist",
      currentIndex: 0,
      volume: 0.85,
      repeatMode: "all",
      shuffle: false,
    },
  },
  "karaoke-lyric-panel": {
    kind: "karaoke-lyric-panel" as const,
    label: "Karaoke lyrics",
    tier: 3 as const,
    description:
      "Timed lyric display with optional HTML5 backing track: payload { subtitle?, songTitle?, artist?, useBackingTrack?: boolean (default true), audioUrl?, volume?: 0–1, lines?: [{ startSec, text }] (sorted on save), rehearsalLineIndex? (when backing track off) }. Highlights active line from playhead or rehearsal arrows; click a line to seek. Agent: `widget.create` kind `karaoke-lyric-panel`.",
    payloadSchema: KaraokeLyricPanelPayloadSchema,
    examplePayload: {
      songTitle: "Demo",
      useBackingTrack: true,
      lines: [
        { startSec: 0, text: "First line" },
        { startSec: 8, text: "Second line" },
      ],
    },
  },
  "guitar-tuner-panel": {
    kind: "guitar-tuner-panel" as const,
    label: "Guitar tuner",
    tier: 3 as const,
    description:
      "Chromatic mic tuner for guitar: payload { subtitle?, referenceHz?: 415–466 (A4), tuningPreset?: standard|drop_d|half_step_down, targetStringIndex?: 0–5 (low→high), inputGain?: 0.5–4 }. Web Audio mic + autocorrelation; cents needle vs selected open string; optional reference tone. Agent: `widget.create` kind `guitar-tuner-panel`.",
    payloadSchema: GuitarTunerPanelPayloadSchema,
    examplePayload: {
      referenceHz: 440,
      tuningPreset: "standard",
      targetStringIndex: 0,
      inputGain: 1.35,
    },
  },
  "snake-game-panel": {
    kind: "snake-game-panel" as const,
    label: "Snake",
    tier: 3 as const,
    description:
      "Classic grid snake: arrow keys or on-screen pad; score and persisted `bestScore`. Payload { subtitle?, bestScore? }. Agent: `widget.create` kind `snake-game-panel`.",
    payloadSchema: SnakeGamePanelPayloadSchema,
    examplePayload: {
      bestScore: 0,
      subtitle: "Catalog #11",
    },
  },
  "tic-tac-toe-panel": {
    kind: "tic-tac-toe-panel" as const,
    label: "Tic-tac-toe",
    tier: 3 as const,
    description:
      "3×3 tic-tac-toe vs minimax AI (you are X, AI is O). Persisted tallies `winsVsAi`, `lossesVsAi`, `drawsVsAi`. Payload { subtitle?, winsVsAi?, lossesVsAi?, drawsVsAi? }. Agent: `widget.create` kind `tic-tac-toe-panel`.",
    payloadSchema: TicTacToePanelPayloadSchema,
    examplePayload: {
      winsVsAi: 0,
      lossesVsAi: 0,
      drawsVsAi: 0,
    },
  },
  "memory-match-panel": {
    kind: "memory-match-panel" as const,
    label: "Memory match",
    tier: 3 as const,
    description:
      "4×4 memory card grid (8 emoji pairs). Persisted `gamesWon` and `bestMoves` (lowest moves to finish; 0 = no best yet). Payload { subtitle?, gamesWon?, bestMoves? }. Agent: `widget.create` kind `memory-match-panel`.",
    payloadSchema: MemoryMatchPanelPayloadSchema,
    examplePayload: {
      gamesWon: 0,
      bestMoves: 0,
    },
  },
  "puzzle-2048-panel": {
    kind: "puzzle-2048-panel" as const,
    label: "2048",
    tier: 3 as const,
    description:
      "Classic 4×4 2048: arrow keys or on-screen pad; merge tiles to reach 2048. Score sums merged values; persisted `bestScore`. Payload { subtitle?, bestScore? }. Agent: `widget.create` kind `puzzle-2048-panel`.",
    payloadSchema: Puzzle2048PanelPayloadSchema,
    examplePayload: {
      bestScore: 0,
    },
  },
  "whack-a-mole-panel": {
    kind: "whack-a-mole-panel" as const,
    label: "Whack-a-Mole",
    tier: 3 as const,
    description:
      "3×3 holes: 30s rounds — tap moles when they pop up. Score = successful whacks; persisted `bestScore` (best single round). Payload { subtitle?, bestScore? }. Agent: `widget.create` kind `whack-a-mole-panel`.",
    payloadSchema: WhackAMolePanelPayloadSchema,
    examplePayload: {
      bestScore: 0,
    },
  },
  "hangman-panel": {
    kind: "hangman-panel" as const,
    label: "Hangman",
    tier: 3 as const,
    description:
      "Guess the hidden word (built-in AIRIS-themed dictionary); 6 wrong letters loses. SVG gallows + letter keyboard + physical keys. Persisted `gamesWon` / `gamesLost`. Payload { subtitle?, gamesWon?, gamesLost? }. Agent: `widget.create` kind `hangman-panel`.",
    payloadSchema: HangmanPanelPayloadSchema,
    examplePayload: {
      gamesWon: 0,
      gamesLost: 0,
    },
  },
  "rock-paper-scissors-panel": {
    kind: "rock-paper-scissors-panel" as const,
    label: "Rock Paper Scissors",
    tier: 3 as const,
    description:
      "Classic RPS vs uniform-random AI: three throws + hotkeys R / P / S. Persisted tallies `winsVsAi`, `lossesVsAi`, `drawsVsAi`. Payload { subtitle?, winsVsAi?, lossesVsAi?, drawsVsAi? }. Agent: `widget.create` kind `rock-paper-scissors-panel`.",
    payloadSchema: RockPaperScissorsPanelPayloadSchema,
    examplePayload: {
      winsVsAi: 0,
      lossesVsAi: 0,
      drawsVsAi: 0,
    },
  },
  "connect-four-panel": {
    kind: "connect-four-panel" as const,
    label: "Connect Four",
    tier: 3 as const,
    description:
      "7×6 grid: you are teal vs AI rose — AI takes winning moves, blocks your four-in-a-row, else center-weighted random. Persisted `winsVsAi`, `lossesVsAi`, `drawsVsAi`. Payload { subtitle?, winsVsAi?, lossesVsAi?, drawsVsAi? }. Agent: `widget.create` kind `connect-four-panel`.",
    payloadSchema: ConnectFourPanelPayloadSchema,
    examplePayload: {
      winsVsAi: 0,
      lossesVsAi: 0,
      drawsVsAi: 0,
    },
  },
  "minesweeper-panel": {
    kind: "minesweeper-panel" as const,
    label: "Minesweeper",
    tier: 3 as const,
    description:
      "Beginner 9×9 with 10 mines: first click clears a safe zone; left-click reveal, right-click or Flag mode for flags. Persisted `gamesWon` / `gamesLost`. Payload { subtitle?, gamesWon?, gamesLost? }. Agent: `widget.create` kind `minesweeper-panel`.",
    payloadSchema: MinesweeperPanelPayloadSchema,
    examplePayload: {
      gamesWon: 0,
      gamesLost: 0,
    },
  },
  "reaction-time-panel": {
    kind: "reaction-time-panel" as const,
    label: "Reaction time",
    tier: 3 as const,
    description:
      "Wait for green, then tap — measures click latency after a random delay; early clicks are invalid. Persisted `bestReactionMs` (0 = none). Payload { subtitle?, bestReactionMs? }. Agent: `widget.create` kind `reaction-time-panel`.",
    payloadSchema: ReactionTimePanelPayloadSchema,
    examplePayload: {
      bestReactionMs: 0,
    },
  },
  "typing-speed-panel": {
    kind: "typing-speed-panel" as const,
    label: "Typing speed",
    tier: 3 as const,
    description:
      "Type the shown line; gross WPM from first key to completion. Wrong keys are ignored. Persisted `bestWpm`. Payload { subtitle?, bestWpm? }. Agent: `widget.create` kind `typing-speed-panel`.",
    payloadSchema: TypingSpeedPanelPayloadSchema,
    examplePayload: {
      bestWpm: 0,
    },
  },
  "pong-panel": {
    kind: "pong-panel" as const,
    label: "Pong",
    tier: 3 as const,
    description:
      "Classic paddle vs AI: W/S or ↑/↓, first to 5 points wins the match; persisted `playerWins` / `aiWins`. Payload { subtitle?, playerWins?, aiWins? }. Agent: `widget.create` kind `pong-panel`.",
    payloadSchema: PongPanelPayloadSchema,
    examplePayload: {
      playerWins: 0,
      aiWins: 0,
    },
  },
  "cli-catalog": {
    kind: "cli-catalog" as const,
    label: "CLI catalog",
    tier: 2 as const,
    description:
      "Operator presets plus **custom argv** for allowlisted Printing Press `*-pp-cli` binaries (`POST …/cli-tools/run`). Responses include a **readableSummary** (JSON expanded to prose-style text when applicable). Not arbitrary shell.",
    payloadSchema: CliCatalogPayloadSchema,
    examplePayload: {
      recentRuns: [],
    },
  },
  "airis-agent": {
    kind: "airis-agent" as const,
    label: "AIRIS agent",
    tier: 1 as const,
    description:
      "Embedded chat agent instance with its own session, messages, and optional system prompt. Payload { sessionId, systemPrompt?, messages, agentStatus?, lastError?, spawnDepth }. Not created via generic widget execution recipes — use workspace UI spawn.",
    payloadSchema: AirisAgentPayloadSchema,
    examplePayload: {
      messages: [],
      spawnDepth: 0,
    },
  },
} as const;

export type RegisteredWidgetKind = keyof typeof WIDGET_KIND_DEFS;

export function assertRegistryMatchesSchema(): void {
  const keys = new Set(Object.keys(WIDGET_KIND_DEFS));
  for (const k of WIDGET_KINDS) {
    if (!keys.has(k)) {
      throw new Error(`Widget kind "${k}" missing from WIDGET_KIND_DEFS`);
    }
  }
}

export function widgetPayloadSchemaForKind(kind: WidgetKind): z.ZodType<unknown> {
  const def = WIDGET_KIND_DEFS[kind as RegisteredWidgetKind];
  if (!def) throw new Error(`Unknown widget kind: ${kind}`);
  return def.payloadSchema;
}

export function parseWidgetPayload(kind: WidgetKind, payload: Record<string, unknown>): unknown {
  const schema = widgetPayloadSchemaForKind(kind);
  return schema.parse(payload);
}

/** Default `data` payload for a new widget of this kind (validated). */
export function createDefaultWidgetData(kind: WidgetKind): Record<string, unknown> {
  const parsed = parseWidgetPayload(kind, {});
  return parsed as Record<string, unknown>;
}

export function displayNameForKind(kind: WidgetKind): string {
  const def = WIDGET_KIND_DEFS[kind as RegisteredWidgetKind];
  return def?.label ?? kind;
}

/** Compact rules for system prompts (generated from registry). */
export function buildWidgetPromptRules(): string {
  const registryLines = Object.values(WIDGET_KIND_DEFS)
    .map(
      (d) =>
        `- **${d.kind}** (${d.label}, tier ${d.tier}): ${d.description} Example: \`${JSON.stringify(d.examplePayload)}\``,
    )
    .join("\n");
  return `${registryLines}\n\n${buildWidgetIntelligencePromptSection()}`;
}
