import { ComparisonPanelWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const comparisonPanelWidgetDefinition: WidgetDefinition = {
  kind: "comparison-panel",
  label: "Comparison panel",
  description: "Side-by-side entities and metrics.",
  defaultSize: { w: 6, h: 5 },
  defaultConfig: { entities: [], highlightDiff: true },
  renderer: ComparisonPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
