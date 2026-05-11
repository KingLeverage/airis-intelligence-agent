import { TypingSpeedPanelWidgetView } from "../../TypingSpeedPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const typingSpeedPanelWidgetDefinition: WidgetDefinition = {
  kind: "typing-speed-panel",
  label: "Typing speed",
  description: "Fixed passages — gross WPM on completion.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: TypingSpeedPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
