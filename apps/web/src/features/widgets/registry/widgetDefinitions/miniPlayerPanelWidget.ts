import { MiniPlayerPanelWidgetView } from "../../MiniPlayerPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const miniPlayerPanelWidgetDefinition: WidgetDefinition = {
  kind: "mini-player-panel",
  label: "Mini player",
  description: "Spotify-style HTML5 audio bar (queue, seek, shuffle, repeat).",
  defaultSize: { w: 12, h: 9 },
  defaultConfig: {},
  renderer: MiniPlayerPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
