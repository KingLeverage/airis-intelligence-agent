import { SequencerPanelWidgetView } from "../../SequencerPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const sequencerPanelWidgetDefinition: WidgetDefinition = {
  kind: "sequencer-panel",
  label: "Step sequencer",
  description: "16th-note grid with play, BPM, and persisted pattern (trusted React renderer).",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: SequencerPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
