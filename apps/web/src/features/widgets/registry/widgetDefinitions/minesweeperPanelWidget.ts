import { MinesweeperPanelWidgetView } from "../../MinesweeperPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const minesweeperPanelWidgetDefinition: WidgetDefinition = {
  kind: "minesweeper-panel",
  label: "Minesweeper",
  description: "9×9, 10 mines; first click safe; flag mode + right-click.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: MinesweeperPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
