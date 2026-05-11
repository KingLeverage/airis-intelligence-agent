import { ChartPanelWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const chartPanelWidgetDefinition: WidgetDefinition = {
  kind: "chart-panel",
  label: "Chart panel",
  description: "Line, area, or bar chart with one or more series.",
  defaultSize: { w: 6, h: 5 },
  defaultConfig: { chartType: "line", series: [] },
  renderer: ChartPanelWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "displayMode", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
