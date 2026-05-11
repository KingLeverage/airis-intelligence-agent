import { TicTacToePanelWidgetView } from "../../TicTacToePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const ticTacToePanelWidgetDefinition: WidgetDefinition = {
  kind: "tic-tac-toe-panel",
  label: "Tic-tac-toe",
  description: "3×3 vs minimax AI; persisted win / loss / draw counts.",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: TicTacToePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
