import type { WidgetKind } from "../schemas/widget.js";
import type { WidgetLayoutPosition } from "../schemas/widget.js";

/** Grid uses 12 columns; w/h are abstract units consumed by the workspace shell. */
export function defaultLayoutForKind(kind: WidgetKind): WidgetLayoutPosition {
  switch (kind) {
    case "stat-ticker":
      return { x: 0, y: 0, w: 12, h: 2 };
    case "chart-panel":
      return { x: 0, y: 0, w: 6, h: 6 };
    case "heatmap-panel":
      return { x: 0, y: 0, w: 8, h: 7 };
    case "timeline-panel":
      return { x: 0, y: 0, w: 5, h: 8 };
    case "news-feed":
      return { x: 0, y: 0, w: 6, h: 6 };
    case "metric-grid":
      return { x: 0, y: 0, w: 6, h: 5 };
    case "lead-finder":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "research-card":
      return { x: 0, y: 0, w: 4, h: 6 };
    case "comparison-panel":
      return { x: 0, y: 0, w: 6, h: 6 };
    case "sequencer-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "drum-machine-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "piano-roll-panel":
      return { x: 0, y: 0, w: 12, h: 18 };
    case "chord-progression-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "loop-recorder-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "metronome-panel":
      return { x: 0, y: 0, w: 12, h: 11 };
    case "synth-keyboard-panel":
      return { x: 0, y: 0, w: 12, h: 16 };
    case "audio-visualizer-panel":
      return { x: 0, y: 0, w: 12, h: 13 };
    case "mini-player-panel":
      return { x: 0, y: 0, w: 12, h: 9 };
    case "karaoke-lyric-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "guitar-tuner-panel":
      return { x: 0, y: 0, w: 12, h: 11 };
    case "snake-game-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "tic-tac-toe-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "memory-match-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "puzzle-2048-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "whack-a-mole-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "hangman-panel":
      return { x: 0, y: 0, w: 12, h: 16 };
    case "rock-paper-scissors-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "connect-four-panel":
      return { x: 0, y: 0, w: 12, h: 15 };
    case "minesweeper-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "reaction-time-panel":
      return { x: 0, y: 0, w: 12, h: 12 };
    case "typing-speed-panel":
      return { x: 0, y: 0, w: 12, h: 14 };
    case "pong-panel":
      return { x: 0, y: 0, w: 12, h: 15 };
    case "cli-catalog":
      /** Wide + tall: output is meant to be read at length; frame uses a single outer scroll. */
      return { x: 0, y: 0, w: 12, h: 18 };
    case "airis-agent":
      return { x: 0, y: 0, w: 5, h: 14 };
    case "html-card":
      /** Rich HTML / infographics need width + height so content is not trapped in a tiny scroll strip. */
      return { x: 0, y: 0, w: 12, h: 14 };
    case "note":
      return { x: 0, y: 0, w: 12, h: 10 };
    case "checklist":
      return { x: 0, y: 0, w: 12, h: 10 };
    default:
      return { x: 0, y: 0, w: 12, h: 10 };
  }
}

/**
 * Tile widgets from `workspace.compose` when entries omit both `x` and `y`
 * (otherwise every panel used defaultLayoutForKind and stacked at the origin).
 */
export function layoutForWorkspaceComposeIndex(index: number, kind: WidgetKind): WidgetLayoutPosition {
  const base = defaultLayoutForKind(kind);
  const col = index % 2;
  const row = Math.floor(index / 2);
  const rowStride = Math.max(base.h + 1, 8);
  /** Up to half-grid width per tile in compose recipes; tall enough to stay readable. */
  const w = Math.min(base.w, 6);
  return {
    x: col * 6,
    y: row * rowStride,
    w,
    h: base.h,
  };
}

/** Offset placement when stacking standalone `widget.create` calls (legacy heuristic). */
export function stackLayoutForIndex(kind: WidgetKind, index: number): WidgetLayoutPosition {
  const base = defaultLayoutForKind(kind);
  if (kind === "stat-ticker") {
    return { ...base, y: index * base.h };
  }
  /** Text-heavy / HTML panels: full-width rows so new widgets open readable (not a short narrow strip). */
  const fullWidthStack =
    kind === "html-card" ||
    kind === "note" ||
    kind === "checklist" ||
    kind === "lead-finder" ||
    kind === "sequencer-panel" ||
    kind === "drum-machine-panel" ||
    kind === "piano-roll-panel" ||
    kind === "chord-progression-panel" ||
    kind === "loop-recorder-panel" ||
    kind === "metronome-panel" ||
    kind === "synth-keyboard-panel" ||
    kind === "audio-visualizer-panel" ||
    kind === "mini-player-panel" ||
    kind === "karaoke-lyric-panel" ||
    kind === "guitar-tuner-panel" ||
    kind === "snake-game-panel" ||
    kind === "tic-tac-toe-panel" ||
    kind === "memory-match-panel" ||
    kind === "puzzle-2048-panel" ||
    kind === "whack-a-mole-panel" ||
    kind === "hangman-panel" ||
    kind === "rock-paper-scissors-panel" ||
    kind === "connect-four-panel" ||
    kind === "minesweeper-panel" ||
    kind === "reaction-time-panel" ||
    kind === "typing-speed-panel" ||
    kind === "pong-panel";
  if (fullWidthStack) {
    const rowStride = Math.max(base.h + 1, 8);
    return {
      ...base,
      x: 0,
      y: index * rowStride,
      w: 12,
      h: base.h,
    };
  }
  const col = index % 2;
  const row = Math.floor(index / 2);
  const rowStride = Math.max(base.h + 1, 8);
  return {
    ...base,
    x: col * 6,
    y: row * rowStride,
    w: Math.min(base.w, 6),
    h: base.h,
  };
}

const COLS = 12;

/** Axis-aligned overlap on the 12-column workspace grid. */
export function gridLayoutsOverlap(a: WidgetLayoutPosition, b: WidgetLayoutPosition): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function clampLayoutToGrid(layout: WidgetLayoutPosition): WidgetLayoutPosition {
  const w = Math.min(COLS, Math.max(1, Math.round(layout.w)));
  const h = Math.max(1, Math.round(layout.h));
  const x = Math.min(COLS - w, Math.max(0, Math.round(layout.x)));
  const y = Math.max(0, Math.round(layout.y));
  return { x, y, w, h };
}

/**
 * Push a proposed layout downward until it does not overlap any existing widget
 * (used when the model omits y or repeats coordinates).
 */
export function nudgeLayoutBelowConflicts(
  proposed: WidgetLayoutPosition,
  others: readonly { layout: WidgetLayoutPosition }[],
): WidgetLayoutPosition {
  let pos = clampLayoutToGrid(proposed);
  for (let iter = 0; iter < 80; iter++) {
    let bumped = false;
    for (const o of others) {
      const L = clampLayoutToGrid(o.layout);
      if (gridLayoutsOverlap(pos, L)) {
        pos.y = Math.max(pos.y, L.y + L.h);
        bumped = true;
      }
    }
    if (!bumped) break;
    pos = clampLayoutToGrid(pos);
  }
  return pos;
}
