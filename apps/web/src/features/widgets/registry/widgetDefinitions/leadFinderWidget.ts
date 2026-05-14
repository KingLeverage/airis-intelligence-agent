import { LeadFinderWidgetView } from "../../LeadFinderWidget";
import type { WidgetDefinition } from "../types";

export const leadFinderWidgetDefinition: WidgetDefinition = {
  kind: "lead-finder",
  label: "Lead finder",
  description: "Maps scrape + website audit as a sortable table with CSV export.",
  defaultSize: { w: 12, h: 8 },
  defaultConfig: {
    query: "",
    businesses: [],
    businessCount: 0,
    websiteFound: 0,
    noWebsiteCount: 0,
    auditedCount: 0,
    avgBadness: null,
    durationMs: 0,
    scrapedAt: "",
    sourceUrl: "",
    locationLabel: "",
  },
  renderer: LeadFinderWidgetView,
  settingsSchema: ["title", "dataSource", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
