import { ConnectFourPanelWidgetView } from "../../ConnectFourPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const connectFourPanelWidgetDefinition: WidgetDefinition = {
  kind: "connect-four-panel",
  label: "Connect Four",
  description: "7×6 vs heuristic AI; columns 1–7; persisted wins/losses/draws.",
  defaultSize: { w: 12, h: 15 },
  defaultConfig: {},
  renderer: ConnectFourPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
