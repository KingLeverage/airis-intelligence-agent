import { PongPanelWidgetView } from "../../PongPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const pongPanelWidgetDefinition: WidgetDefinition = {
  kind: "pong-panel",
  label: "Pong",
  description: "W/S vs AI — first to five points per match.",
  defaultSize: { w: 12, h: 15 },
  defaultConfig: {},
  renderer: PongPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
