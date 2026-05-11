import { TimelinePanelWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const timelinePanelWidgetDefinition: WidgetDefinition = {
  kind: "timeline-panel",
  label: "Timeline panel",
  description: "Vertical milestone stream with optional semantic tones.",
  defaultSize: { w: 5, h: 7 },
  defaultConfig: { events: [] },
  renderer: TimelinePanelWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "displayMode", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
