import type { WidgetKind, WidgetLayoutPosition, WidgetRecord } from "@airis/shared";
import { WIDGET_KINDS } from "@airis/shared";
import { chartPanelWidgetDefinition } from "./widgetDefinitions/chartPanelWidget";
import { heatmapPanelWidgetDefinition } from "./widgetDefinitions/heatmapPanelWidget";
import { chordProgressionPanelWidgetDefinition } from "./widgetDefinitions/chordProgressionPanelWidget";
import { loopRecorderPanelWidgetDefinition } from "./widgetDefinitions/loopRecorderPanelWidget";
import { metronomePanelWidgetDefinition } from "./widgetDefinitions/metronomePanelWidget";
import { synthKeyboardPanelWidgetDefinition } from "./widgetDefinitions/synthKeyboardPanelWidget";
import { audioVisualizerPanelWidgetDefinition } from "./widgetDefinitions/audioVisualizerPanelWidget";
import { miniPlayerPanelWidgetDefinition } from "./widgetDefinitions/miniPlayerPanelWidget";
import { karaokeLyricPanelWidgetDefinition } from "./widgetDefinitions/karaokeLyricPanelWidget";
import { guitarTunerPanelWidgetDefinition } from "./widgetDefinitions/guitarTunerPanelWidget";
import { snakeGamePanelWidgetDefinition } from "./widgetDefinitions/snakeGamePanelWidget";
import { ticTacToePanelWidgetDefinition } from "./widgetDefinitions/ticTacToePanelWidget";
import { memoryMatchPanelWidgetDefinition } from "./widgetDefinitions/memoryMatchPanelWidget";
import { puzzle2048PanelWidgetDefinition } from "./widgetDefinitions/puzzle2048PanelWidget";
import { whackAMolePanelWidgetDefinition } from "./widgetDefinitions/whackAMolePanelWidget";
import { hangmanPanelWidgetDefinition } from "./widgetDefinitions/hangmanPanelWidget";
import { rockPaperScissorsPanelWidgetDefinition } from "./widgetDefinitions/rockPaperScissorsPanelWidget";
import { connectFourPanelWidgetDefinition } from "./widgetDefinitions/connectFourPanelWidget";
import { minesweeperPanelWidgetDefinition } from "./widgetDefinitions/minesweeperPanelWidget";
import { reactionTimePanelWidgetDefinition } from "./widgetDefinitions/reactionTimePanelWidget";
import { typingSpeedPanelWidgetDefinition } from "./widgetDefinitions/typingSpeedPanelWidget";
import { pongPanelWidgetDefinition } from "./widgetDefinitions/pongPanelWidget";
import { airisAgentWidgetDefinition } from "./widgetDefinitions/airisAgentWidget";
import { cliCatalogWidgetDefinition } from "./widgetDefinitions/cliCatalogWidget";
import { checklistWidgetDefinition } from "./widgetDefinitions/checklistWidget";
import { comparisonPanelWidgetDefinition } from "./widgetDefinitions/comparisonPanelWidget";
import { drumMachinePanelWidgetDefinition } from "./widgetDefinitions/drumMachinePanelWidget";
import { htmlCardWidgetDefinition } from "./widgetDefinitions/htmlCardWidget";
import { metricGridWidgetDefinition } from "./widgetDefinitions/metricGridWidget";
import { newsFeedWidgetDefinition } from "./widgetDefinitions/newsFeedWidget";
import { noteWidgetDefinition } from "./widgetDefinitions/noteWidget";
import { pianoRollPanelWidgetDefinition } from "./widgetDefinitions/pianoRollPanelWidget";
import { researchCardWidgetDefinition } from "./widgetDefinitions/researchCardWidget";
import { sequencerPanelWidgetDefinition } from "./widgetDefinitions/sequencerPanelWidget";
import { statTickerWidgetDefinition } from "./widgetDefinitions/statTickerWidget";
import { timelinePanelWidgetDefinition } from "./widgetDefinitions/timelinePanelWidget";
import type { WidgetDefinition } from "./types";

const REGISTRY = new Map<WidgetKind, WidgetDefinition>();

export function registerWidget(definition: WidgetDefinition): void {
  if (REGISTRY.has(definition.kind)) {
    throw new Error(`Widget kind already registered: ${definition.kind}`);
  }
  REGISTRY.set(definition.kind, definition);
}

[
  noteWidgetDefinition,
  htmlCardWidgetDefinition,
  checklistWidgetDefinition,
  statTickerWidgetDefinition,
  chartPanelWidgetDefinition,
  heatmapPanelWidgetDefinition,
  timelinePanelWidgetDefinition,
  newsFeedWidgetDefinition,
  metricGridWidgetDefinition,
  researchCardWidgetDefinition,
  comparisonPanelWidgetDefinition,
  sequencerPanelWidgetDefinition,
  drumMachinePanelWidgetDefinition,
  pianoRollPanelWidgetDefinition,
  chordProgressionPanelWidgetDefinition,
  loopRecorderPanelWidgetDefinition,
  metronomePanelWidgetDefinition,
  synthKeyboardPanelWidgetDefinition,
  audioVisualizerPanelWidgetDefinition,
  miniPlayerPanelWidgetDefinition,
  karaokeLyricPanelWidgetDefinition,
  guitarTunerPanelWidgetDefinition,
  snakeGamePanelWidgetDefinition,
  ticTacToePanelWidgetDefinition,
  memoryMatchPanelWidgetDefinition,
  puzzle2048PanelWidgetDefinition,
  whackAMolePanelWidgetDefinition,
  hangmanPanelWidgetDefinition,
  rockPaperScissorsPanelWidgetDefinition,
  connectFourPanelWidgetDefinition,
  minesweeperPanelWidgetDefinition,
  reactionTimePanelWidgetDefinition,
  typingSpeedPanelWidgetDefinition,
  pongPanelWidgetDefinition,
  cliCatalogWidgetDefinition,
  airisAgentWidgetDefinition,
].forEach(registerWidget);

for (const kind of WIDGET_KINDS) {
  if (!REGISTRY.has(kind)) throw new Error(`Missing widget UI definition for kind "${kind}"`);
}

export function getWidgetDefinition(kind: WidgetKind): WidgetDefinition | undefined {
  return REGISTRY.get(kind);
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return [...REGISTRY.values()];
}

export function createDefaultWidget(kind: WidgetKind): {
  kind: WidgetKind;
  title: string;
  data: Record<string, unknown>;
  layout: Pick<WidgetLayoutPosition, "w" | "h">;
} {
  const def = getWidgetDefinition(kind);
  if (!def) throw new Error(`Unknown widget kind: ${kind}`);
  return {
    kind,
    title: def.label,
    data: { ...def.defaultConfig },
    layout: { ...def.defaultSize },
  };
}

export function rendererForKind(kind: WidgetKind): WidgetDefinition["renderer"] | undefined {
  return getWidgetDefinition(kind)?.renderer;
}

export function canRenderWidget(record: WidgetRecord): boolean {
  return Boolean(rendererForKind(record.kind));
}
