import { SnakeGamePanelWidgetView } from "../../SnakeGamePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const snakeGamePanelWidgetDefinition: WidgetDefinition = {
  kind: "snake-game-panel",
  label: "Snake",
  description: "Classic snake on a grid; keyboard or direction pad.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: SnakeGamePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
