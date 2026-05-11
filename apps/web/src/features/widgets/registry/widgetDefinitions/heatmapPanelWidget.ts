import { HeatmapPanelWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const heatmapPanelWidgetDefinition: WidgetDefinition = {
  kind: "heatmap-panel",
  label: "Heatmap panel",
  description: "Row × column matrix with intensity-colored cells.",
  defaultSize: { w: 8, h: 6 },
  defaultConfig: { rowLabels: [], colLabels: [], cells: [] },
  renderer: HeatmapPanelWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "displayMode", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
