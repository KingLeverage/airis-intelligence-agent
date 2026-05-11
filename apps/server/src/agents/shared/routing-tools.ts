import type { AnthropicToolDef } from "../../llm/anthropic-tool-completion.js";

/** Orchestrator tools: single Claude `tool_use` turn decides routing. */
export const ORCHESTRATOR_ROUTING_TOOLS: AnthropicToolDef[] = [
  {
    name: "route_to_builder",
    description:
      "Use when the user wants to design, generate, or implement a new AIRIS workspace widget, dashboard panel, or widget code. Examples: build a chart, add a timer, create a game widget, scaffold widget payload.",
    input_schema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What to build or change in widget terms; pass the user’s intent verbatim when possible.",
        },
      },
      required: ["request"],
    },
  },
  {
    name: "route_to_context",
    description:
      "Use when the user asks what is on the workspace canvas, how widgets are arranged, summaries, or questions about current workspace contents (not building new widgets).",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question about the current workspace/canvas state.",
        },
      },
      required: ["question"],
    },
  },
];
