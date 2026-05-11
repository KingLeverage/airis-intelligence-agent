import { LoopRecorderPanelWidgetView } from "../../LoopRecorderPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const loopRecorderPanelWidgetDefinition: WidgetDefinition = {
  kind: "loop-recorder-panel",
  label: "Loop recorder",
  description: "MediaRecorder mic capture; looping playback; clip in widget payload.",
  defaultSize: { w: 12, h: 12 },
  defaultConfig: {},
  renderer: LoopRecorderPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
