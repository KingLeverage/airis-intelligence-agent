import { NewsFeedWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const newsFeedWidgetDefinition: WidgetDefinition = {
  kind: "news-feed",
  label: "News feed",
  description: "Scrollable source-labeled headline stream.",
  defaultSize: { w: 6, h: 5 },
  defaultConfig: { items: [], maxItems: 8, showTimestamps: true },
  renderer: NewsFeedWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
