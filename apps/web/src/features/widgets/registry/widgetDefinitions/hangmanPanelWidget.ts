import { HangmanPanelWidgetView } from "../../HangmanPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const hangmanPanelWidgetDefinition: WidgetDefinition = {
  kind: "hangman-panel",
  label: "Hangman",
  description: "Guess the word; 6 wrong letters; keyboard + buttons; persisted wins/losses.",
  defaultSize: { w: 12, h: 16 },
  defaultConfig: {},
  renderer: HangmanPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
