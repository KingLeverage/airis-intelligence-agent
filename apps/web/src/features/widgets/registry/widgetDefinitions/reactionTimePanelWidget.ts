import { ReactionTimePanelWidgetView } from "../../ReactionTimePanelWidgetView";
import type { WidgetDefinition } from "../types";

export const reactionTimePanelWidgetDefinition: WidgetDefinition = {
  kind: "reaction-time-panel",
  label: "Reaction time",
  description: "Wait for green, then click — best time persisted.",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: ReactionTimePanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
