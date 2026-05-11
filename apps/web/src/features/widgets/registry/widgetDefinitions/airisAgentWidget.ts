import { AirisAgentWidgetView } from "../../AirisAgentWidgetView";
import type { WidgetDefinition } from "../types";

export const airisAgentWidgetDefinition: WidgetDefinition = {
  kind: "airis-agent",
  label: "AIRIS agent",
  description: "Embedded streaming agent with its own session and message history.",
  defaultSize: { w: 5, h: 14 },
  defaultConfig: {
    messages: [],
    agentStatus: "idle",
    spawnDepth: 0,
  },
  renderer: AirisAgentWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
