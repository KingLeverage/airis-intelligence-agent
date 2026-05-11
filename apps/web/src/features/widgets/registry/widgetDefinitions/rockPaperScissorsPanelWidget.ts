import { RockPaperScissorsPanelWidgetView } from "../../RockPaperScissorsPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const rockPaperScissorsPanelWidgetDefinition: WidgetDefinition = {
  kind: "rock-paper-scissors-panel",
  label: "Rock Paper Scissors",
  description: "RPS vs random AI; R/P/S keys; persisted wins, losses, draws.",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: RockPaperScissorsPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
