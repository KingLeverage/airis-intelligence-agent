import { WhackAMolePanelWidgetView } from "../../WhackAMolePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const whackAMolePanelWidgetDefinition: WidgetDefinition = {
  kind: "whack-a-mole-panel",
  label: "Whack-a-Mole",
  description: "3×3 holes, 30s rounds; tap moles; persisted best round score.",
  defaultSize: { w: 12, h: 14 },
  defaultConfig: {},
  renderer: WhackAMolePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
