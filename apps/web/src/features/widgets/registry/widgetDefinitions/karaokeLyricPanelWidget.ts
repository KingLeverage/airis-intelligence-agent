import { KaraokeLyricPanelWidgetView } from "../../KaraokeLyricPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const karaokeLyricPanelWidgetDefinition: WidgetDefinition = {
  kind: "karaoke-lyric-panel",
  label: "Karaoke lyrics",
  description: "Timed lyrics with optional backing track and rehearsal mode.",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: KaraokeLyricPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
