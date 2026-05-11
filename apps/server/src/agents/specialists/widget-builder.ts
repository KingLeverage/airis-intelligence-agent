import type { WidgetSpec } from "@airis/shared";
import { streamLlmResponse } from "../../llm/stream.js";
import { retrieveWidgetSpecs } from "../shared/rag.js";
import type { SpecialistParams } from "../shared/types.js";

function formatSpecList(specs: WidgetSpec[]): string {
  if (specs.length === 0) {
    return "(No widget specification entries loaded yet in this deployment.)";
  }
  return specs
    .map(
      (s) =>
        `- **${s.title}** (${s.id})${s.category ? ` [${s.category}]` : ""}\n  ${s.description.slice(0, 400)}${s.description.length > 400 ? "…" : ""}`,
    )
    .join("\n");
}

export async function* streamWidgetBuilder(
  params: SpecialistParams & { userRequest: string },
): AsyncGenerator<string> {
  const { userRequest, request, runtime, modelId } = params;
  const retrieved = retrieveWidgetSpecs(userRequest, 3);
  const fewShot = formatSpecList(retrieved);

  const system = `You are the AIRIS **widget builder** specialist. Help design or describe how to build AIRIS workspace widgets using the widget spec excerpts below (retrieved for this request). You may propose payloads, layout hints, and integration notes. Do not execute code or call external APIs.

## Retrieved widget specs (top matches)
${fewShot}`;

  if (runtime.kind === "mock") {
    const titles = retrieved.map((s) => s.title).join(", ");
    yield `[widget-builder • mock] Matched ${retrieved.length} spec(s) via TF–IDF${titles ? ` — ${titles}` : ""}. Request: ${userRequest.slice(0, 240)}`;
    return;
  }

  for await (const chunk of streamLlmResponse({
    history: request.conversationHistory,
    userMessage: `Widget / panel request:\n${userRequest}`,
    modelId,
    system,
    runtime,
  })) {
    yield chunk;
  }
}
