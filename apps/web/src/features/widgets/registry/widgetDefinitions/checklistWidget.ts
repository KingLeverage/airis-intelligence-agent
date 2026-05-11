import { ChecklistWidgetView } from "../../WidgetViews";
import type { WidgetDefinition } from "../types";

export const checklistWidgetDefinition: WidgetDefinition = {
  kind: "checklist",
  label: "Checklist",
  description: "Task list with persistent checked state.",
  defaultSize: { w: 4, h: 3 },
  defaultConfig: { items: [] },
  renderer: ChecklistWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
