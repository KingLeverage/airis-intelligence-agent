import type { ModelCompletionAdapter, ModelCompletionContext } from "./types.js";
import type { LlmRuntime } from "../resolve-llm-runtime.js";
import {
  openAiCompatibleComplete,
  openRouterImageOutputModalities,
  prepareOpenRouterImageOutputChat,
} from "../openai-compatible-chat.js";
import { prepareOpenRouterTextChat } from "../openrouter-context-budget.js";
import { openRouterHistoryMessageCap } from "../openrouter-profile-utils.js";

async function anthropicComplete(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`anthropic_http_${res.status}: ${err.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return data.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join("");
}

export class RuntimeModelAdapter implements ModelCompletionAdapter {
  constructor(
    private readonly runtime: Exclude<LlmRuntime, { kind: "mock" } | { kind: "unconfigured_openrouter" }>,
  ) {}

  async complete(ctx: ModelCompletionContext): Promise<string> {
    const r = this.runtime;
    const profileHistLimit = r.kind === "openrouter" ? r.historyLimit : 24;
    const histLimit =
      r.kind === "openrouter"
        ? openRouterHistoryMessageCap(r.model, profileHistLimit)
        : profileHistLimit;
    const recent = ctx.history.slice(-histLimit);

    if (r.kind === "openrouter") {
      let system = ctx.systemPrompt;
      let userMessage = ctx.userMessage;
      let recentRows = recent
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      if (openRouterImageOutputModalities(r.model)) {
        const p = prepareOpenRouterImageOutputChat({
          system,
          userMessage,
          history: ctx.history,
          baseHistoryLimit: histLimit,
        });
        system = p.system;
        userMessage = p.userMessage;
        recentRows = p.recentRows;
      } else {
        const prepared = prepareOpenRouterTextChat({
          model: r.model,
          system,
          userMessage,
          recentRows,
        });
        system = prepared.system;
        userMessage = prepared.userMessage;
        recentRows = prepared.recentRows;
      }
      const msgs: { role: "user" | "assistant" | "system"; content: string }[] = [
        { role: "system", content: system },
        ...recentRows,
        { role: "user", content: userMessage },
      ];
      const extra: Record<string, string | undefined> = {};
      if (r.referer) extra["HTTP-Referer"] = r.referer;
      if (r.title) extra["X-Title"] = r.title;
      return openAiCompatibleComplete({
        baseUrl: r.baseUrl,
        apiKey: r.apiKey,
        model: r.model,
        messages: msgs,
        temperature: r.temperature,
        ...(r.max_tokens !== undefined ? { max_tokens: r.max_tokens } : {}),
        extraHeaders: extra,
      });
    }

    if (r.kind === "anthropic_env") {
      const msgs = [
        ...recent
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: ctx.userMessage },
      ];
      return anthropicComplete(msgs, ctx.systemPrompt, r.apiKey, r.model);
    }

    if (r.kind === "openai_env") {
      const msgs: { role: "user" | "assistant" | "system"; content: string }[] = [
        { role: "system", content: ctx.systemPrompt },
        ...recent
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: ctx.userMessage },
      ];
      return openAiCompatibleComplete({
        baseUrl: r.baseUrl,
        apiKey: r.apiKey,
        model: r.model,
        messages: msgs,
        temperature: 0.7,
      });
    }

    const _exhaustive: never = r;
    return Promise.reject(new Error(`unknown_runtime: ${String(_exhaustive)}`));
  }
}
