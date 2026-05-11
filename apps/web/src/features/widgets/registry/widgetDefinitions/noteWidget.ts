import { NoteWidgetView } from "../../WidgetViews";
import type { WidgetDefinition } from "../types";

export const noteWidgetDefinition: WidgetDefinition = {
  kind: "note",
  label: "Note",
  description: "Editable plain text note.",
  defaultSize: { w: 4, h: 3 },
  defaultConfig: { content: "" },
  renderer: NoteWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
