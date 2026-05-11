import { ChordProgressionPanelWidgetView } from "../../ChordProgressionPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const chordProgressionPanelWidgetDefinition: WidgetDefinition = {
  kind: "chord-progression-panel",
  label: "Chord progression",
  description: "Key + mode, four diatonic triads, pad playback, MIDI export.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: ChordProgressionPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
