import { ResearchCardWidgetView } from "../../DataWidgetViews";
import type { WidgetDefinition } from "../types";

export const researchCardWidgetDefinition: WidgetDefinition = {
  kind: "research-card",
  label: "Research card",
  description: "Synthesis card with bullets, tags, and citations.",
  defaultSize: { w: 4, h: 5 },
  defaultConfig: { summary: "", bullets: [], tags: [] },
  renderer: ResearchCardWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
