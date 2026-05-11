import { AudioVisualizerPanelWidgetView } from "../../AudioVisualizerPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const audioVisualizerPanelWidgetDefinition: WidgetDefinition = {
  kind: "audio-visualizer-panel",
  label: "Audio visualizer",
  description: "Mic spectrum bars (AnalyserNode + canvas).",
  defaultSize: { w: 12, h: 13 },
  defaultConfig: {},
  renderer: AudioVisualizerPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
