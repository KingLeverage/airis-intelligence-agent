import { DrumMachinePanelWidgetView } from "../../DrumMachinePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const drumMachinePanelWidgetDefinition: WidgetDefinition = {
  kind: "drum-machine-panel",
  label: "Drum machine",
  description: "2×16 kick/snare with Tone.js, BPM, swing, and neon playhead.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: DrumMachinePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
