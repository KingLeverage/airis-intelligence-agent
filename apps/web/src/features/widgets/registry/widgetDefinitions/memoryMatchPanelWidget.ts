import { MemoryMatchPanelWidgetView } from "../../MemoryMatchPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const memoryMatchPanelWidgetDefinition: WidgetDefinition = {
  kind: "memory-match-panel",
  label: "Memory match",
  description: "4×4 emoji pairs; persisted games won and best move count.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: MemoryMatchPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
