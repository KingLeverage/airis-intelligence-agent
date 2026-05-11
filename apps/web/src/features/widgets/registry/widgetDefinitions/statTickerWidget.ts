import { StatTickerWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const statTickerWidgetDefinition: WidgetDefinition = {
  kind: "stat-ticker",
  label: "Stat ticker",
  description: "Dense horizontal market/status ticker.",
  defaultSize: { w: 12, h: 2 },
  defaultConfig: { symbols: [], trendMode: "neutral" },
  renderer: StatTickerWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
