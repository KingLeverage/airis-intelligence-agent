import { GuitarTunerPanelWidgetView } from "../../GuitarTunerPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const guitarTunerPanelWidgetDefinition: WidgetDefinition = {
  kind: "guitar-tuner-panel",
  label: "Guitar tuner",
  description: "Mic chromatic tuner with cents vs open-string targets.",
  defaultSize: { w: 12, h: 11 },
  defaultConfig: {},
  renderer: GuitarTunerPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
