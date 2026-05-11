import { MetronomePanelWidgetView } from "../../MetronomePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const metronomePanelWidgetDefinition: WidgetDefinition = {
  kind: "metronome-panel",
  label: "Metronome",
  description: "BPM, beats/bar, downbeat accent; Tone.Transport + visual pulse.",
  defaultSize: { w: 12, h: 11 },
  defaultConfig: {},
  renderer: MetronomePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
