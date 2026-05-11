import type { ChatMessage } from "@airis/shared";
import { mockModelRawText } from "./adapters/mock-adapter.js";
import type { LlmRuntime } from "./resolve-llm-runtime.js";
import { streamAnthropicTextStream } from "./anthropic-text-stream.js";
import {
  openAiCompatibleStream,
  openRouterImageOutputModalities,
  prepareOpenRouterImageOutputChat,
} from "./openai-compatible-chat.js";
import { applyOpenRouterHistoryBudget, clipOpenRouterUserMessage } from "./openrouter-context-budget.js";

export type StreamLlmArgs = {
  history: ChatMessage[];
  userMessage: string;
  modelId: string;
  system: string;
  runtime: LlmRuntime;
};

async function* streamMock(fullText: string): AsyncGenerator<string> {
  const parts = fullText.split(/(\s+)/);
  for (const p of parts) {
    if (p) yield p;
  }
}

export async function* streamLlmResponse(args: StreamLlmArgs): AsyncGenerator<string> {
  const rt = args.runtime;
  const histLimit = rt.kind === "openrouter" ? rt.historyLimit : 24;
  const recent = args.history.slice(-histLimit);

  if (rt.kind === "mock") {
    const full = mockModelRawText(args.userMessage);
    yield* streamMock(full);
    return;
  }

  if (rt.kind === "openrouter") {
    let system = args.system;
    let userMessage = args.userMessage;
    let recentRows = recent
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (openRouterImageOutputModalities(rt.model)) {
      const p = prepareOpenRouterImageOutputChat({
        system,
        userMessage,
        history: args.history,
        baseHistoryLimit: histLimit,
      });
      system = p.system;
      userMessage = p.userMessage;
      recentRows = p.recentRows;
    }
    recentRows = applyOpenRouterHistoryBudget(recentRows);
    userMessage = clipOpenRouterUserMessage(userMessage);
    const msgs: { role: "user" | "assistant" | "system"; content: string }[] = [
      { role: "system", content: system },
      ...recentRows,
      { role: "user", content: userMessage },
    ];
    const extra: Record<string, string | undefined> = {};
    if (rt.referer) extra["HTTP-Referer"] = rt.referer;
    if (rt.title) extra["X-Title"] = rt.title;
    yield* openAiCompatibleStream({
      baseUrl: rt.baseUrl,
      apiKey: rt.apiKey,
      model: rt.model,
      messages: msgs,
      temperature: rt.temperature,
      ...(rt.max_tokens !== undefined ? { max_tokens: rt.max_tokens } : {}),
      extraHeaders: extra,
    });
    return;
  }

  if (rt.kind === "anthropic_env") {
    const msgs = [
      ...recent
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: args.userMessage },
    ];
    yield* streamAnthropicTextStream(args.system, msgs, rt.apiKey, rt.model);
    return;
  }

  if (rt.kind === "openai_env") {
    const msgs: { role: "user" | "assistant" | "system"; content: string }[] = [
      { role: "system", content: args.system },
      ...recent
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: args.userMessage },
    ];
    yield* openAiCompatibleStream({
      baseUrl: rt.baseUrl,
      apiKey: rt.apiKey,
      model: rt.model,
      messages: msgs,
      temperature: 0.7,
    });
  }
}
