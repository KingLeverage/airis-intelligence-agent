import { HtmlCardWidgetView } from "../../WidgetViews";
import type { WidgetDefinition } from "../types";

export const htmlCardWidgetDefinition: WidgetDefinition = {
  kind: "html-card",
  label: "HTML card",
  description: "Trusted sanitized HTML fragment with plain fallback.",
  defaultSize: { w: 4, h: 3 },
  defaultConfig: { html: "", plain: "" },
  renderer: HtmlCardWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
