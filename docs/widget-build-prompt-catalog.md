# Agentic widget build prompt catalog

## Machine-readable index

`@airis/shared` exports **`WIDGET_BUILD_PROMPT_INDEX`**: 100 entries with `id` (1–100), `category`, and `title`. Use this for training manifests, eval suites, and roadmap tracking.

Source: `packages/shared/src/constants/widgetBuildPromptCatalogIndex.ts`.

## Full natural-language prompts

The **verbatim build prompts** (stylish, build-ready paragraphs for each widget) should live in this document under **Prompt library** so SFT and human reviewers stay in sync with the repo. If you have them in an external doc, paste them here or add a second file (e.g. `docs/widget-build-prompt-catalog.full.md`) and link it from this section.

## Standard format notes (for every widget)

Each widget should be self-contained (single component or single HTML file), use vanilla JS or the framework matching the workspace, include real working logic (not placeholder UI), persist state to `localStorage` where relevant, follow the workspace’s dark/light theme tokens, expose clear props or config options, and include at minimum a default ready-to-use state so users see value the moment it loads.

**AIRIS note:** Interactive widgets ship as **trusted registry renderers** with Zod-backed payloads—no model-supplied `eval`. For each catalog item, map the prompt to a `WidgetKind` + payload schema (or split into multiple composable widgets) before training the model on `<<<EXECUTION` traces.

## Implementation status (repo)

| Catalog ID | Title                         | AIRIS widget kind / notes                                      |
| ----------- | ----------------------------- | -------------------------------------------------------------- |
| 1           | Two-Row Drum Machine          | Implemented as **`drum-machine-panel`** (Tone.js, 2×16, swing). |
| 2           | Piano Roll Mini Sequencer     | Implemented as **`piano-roll-panel`** (C4–B4 × 16, PolySynth, ADSR). |
| 3           | Chord Progression Generator   | Implemented as **`chord-progression-panel`** (key/mode, four triads, MIDI). |
| 4           | Looping Audio Recorder        | Implemented as **`loop-recorder-panel`** (MediaRecorder, base64 clip, loop playback). |
| 5           | Metronome with Visual Pulse     | Implemented as **`metronome-panel`** (Tone.Transport, click, pulsing beat ring). |
| 6           | Synthesizer Keyboard            | Implemented as **`synth-keyboard-panel`** (PolySynth, piano keys, ADSR + wave). |
| 7           | Audio Visualizer                | Implemented as **`audio-visualizer-panel`** (mic → AnalyserNode → canvas bars). |
| 8           | Spotify-Style Mini Player       | Implemented as **`mini-player-panel`** (HTML5 audio, queue, seek, shuffle/repeat). |
| 9           | Karaoke Lyric Display           | Implemented as **`karaoke-lyric-panel`** (timed `lines` + optional backing track, rehearsal mode). |
| 10          | Guitar Tuner                    | Implemented as **`guitar-tuner-panel`** (mic + autocorrelation, cents vs open strings, reference tone). |
| 11          | Simple Snake Game               | Implemented as **`snake-game-panel`**.                         |
| 12          | Tic-Tac-Toe with AI             | Implemented as **`tic-tac-toe-panel`**.                        |
| 13          | Memory Match Card Game          | Implemented as **`memory-match-panel`**.                       |
| 14          | 2048 Puzzle                     | Implemented as **`puzzle-2048-panel`** (4×4, arrows + pad, persisted `bestScore`). |
| 15          | Whack-a-Mole                    | Implemented as **`whack-a-mole-panel`** (3×3, 30s rounds, persisted `bestScore`). |
| 16          | Hangman                         | Implemented as **`hangman-panel`** (dictionary, 6 wrong, SVG + keyboard; `gamesWon` / `gamesLost`). |
| 17          | Rock Paper Scissors             | Implemented as **`rock-paper-scissors-panel`** (random AI; `winsVsAi` / `lossesVsAi` / `drawsVsAi`). |
| 18          | Connect Four                    | Implemented as **`connect-four-panel`** (7×6, win/block heuristic AI; same tallies). |
| 19          | Minesweeper                     | Implemented as **`minesweeper-panel`** (9×9, 10 mines; `gamesWon` / `gamesLost`). |
| 20–100      | _See index_                     | Not yet implemented—add kinds incrementally.                   |

## Prompt library

_Paste the full 100 prompt texts here (same order as `WIDGET_BUILD_PROMPT_INDEX`), or maintain them in a linked file in this folder._
