import { PianoRollPanelWidgetView } from "../../PianoRollPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const pianoRollPanelWidgetDefinition: WidgetDefinition = {
  kind: "piano-roll-panel",
  label: "Piano roll",
  description: "C4–B4 × 16 steps, Tone.PolySynth, waveform + ADSR.",
  defaultSize: { w: 12, h: 18 },
  defaultConfig: {},
  renderer: PianoRollPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
