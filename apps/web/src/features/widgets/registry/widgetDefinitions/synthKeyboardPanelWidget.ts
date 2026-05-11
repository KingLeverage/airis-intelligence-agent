import { SynthKeyboardPanelWidgetView } from "../../SynthKeyboardPanelWidgetView";
import type { WidgetDefinition } from "../types";

export const synthKeyboardPanelWidgetDefinition: WidgetDefinition = {
  kind: "synth-keyboard-panel",
  label: "Synth keyboard",
  description: "Piano-style keys, PolySynth, ADSR + waveform.",
  defaultSize: { w: 12, h: 16 },
  defaultConfig: {},
  renderer: SynthKeyboardPanelWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
