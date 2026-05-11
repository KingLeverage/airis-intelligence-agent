import { Puzzle2048PanelWidgetView } from "../../Puzzle2048PanelWidgetView";
import type { WidgetDefinition } from "../types";

export const puzzle2048PanelWidgetDefinition: WidgetDefinition = {
  kind: "puzzle-2048-panel",
  label: "2048",
  description: "4×2048 sliding puzzle; keyboard or pad; persisted best score.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: Puzzle2048PanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
