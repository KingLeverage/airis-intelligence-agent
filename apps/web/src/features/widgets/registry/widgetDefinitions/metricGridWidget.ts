import { MetricGridWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const metricGridWidgetDefinition: WidgetDefinition = {
  kind: "metric-grid",
  label: "Metric grid",
  description: "KPI tiles for compact dashboards.",
  defaultSize: { w: 6, h: 4 },
  defaultConfig: { metrics: [], columns: 2 },
  renderer: MetricGridWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
