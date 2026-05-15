import type { AgentStreamRequest } from "@airis/shared";
import { completeAnthropicWithTools } from "../llm/anthropic-tool-completion.js";
import { streamLlmResponse } from "../llm/stream.js";
import type { LlmRuntime } from "../llm/resolve-llm-runtime.js";
import type { ChatMessage } from "@airis/shared";
import { ORCHESTRATOR_ROUTING_TOOLS } from "./shared/routing-tools.js";
import { streamWidgetBuilder } from "./specialists/widget-builder.js";
import { streamWorkspaceContext } from "./specialists/workspace-context.js";
import type { EmbeddedAgentContext, SpecialistParams } from "./shared/types.js";

function buildOrchestratorSystem(req: AgentStreamRequest): string {
  return `You are the embedded **AIRIS orchestrator** inside the workspace. You route user messages using tools when appropriate.

## Current workspace snapshot (JSON)
${JSON.stringify(req.workspaceSnapshot, null, 2)}

## Rules
- Call **route_to_builder** when the user wants to create, design, generate, or implement a widget or dashboard panel.
- Call **route_to_context** when they ask what is on the canvas, which widgets exist, or other questions about the current workspace state (not about building new widgets).
- If neither applies (general chat, clarifications, greetings), **do not call tools** — reply with a short helpful assistant message in plain text.

Keep tool inputs concise; copy the user’s intent into the tool arguments when relevant.`;
}

function historyToAnthropicMessages(history: ChatMessage[], latestUser: string) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content: m.content });
    }
  }
  out.push({ role: "user", content: latestUser });
  return out;
}

async function* chunkText(text: string): AsyncGenerator<string> {
  const parts = text.split(/(\s+)/);
  for (const p of parts) {
    if (p) yield p;
  }
}

/** Keyword routing when Claude tools are unavailable (mock / non-Anthropic runtimes). */
function heuristicRoute(message: string):
  | { tag: "builder"; request: string }
  | { tag: "context"; question: string }
  | { tag: "direct" } {
  const lower = message.toLowerCase();
  if (
    /\b(what widgets|which widgets|on my canvas|on the canvas|currently on|what.*\bon the workspace)\b/i.test(
      message,
    )
  ) {
    return { tag: "context", question: message };
  }
  if (
    /\b(pomodoro|build\b.*\bwidget|widget\b.*\b(build|create|make)|create\b.*\bwidget|implement\b.*\bwidget|timer|dashboard panel|new widget)\b/i.test(
      lower,
    ) ||
    /\bbuild me\b/i.test(message)
  ) {
    return { tag: "builder", request: message };
  }
  return { tag: "direct" };
}

async function* streamDirectAnswer(
  runtime: LlmRuntime,
  modelId: string,
  history: ChatMessage[],
  userMessage: string,
): AsyncGenerator<string> {
  const system = `You are a concise assistant inside the AIRIS workspace. Answer briefly and helpfully.`;
  if (runtime.kind === "unconfigured_openrouter") {
    for await (const c of streamLlmResponse({
      history,
      userMessage,
      modelId,
      system,
      runtime,
    })) {
      yield c;
    }
    return;
  }
  if (runtime.kind === "mock") {
    yield "[orchestrator • mock] No specialist route matched; general reply mode.";
    return;
  }
  for await (const c of streamLlmResponse({
    history,
    userMessage,
    modelId,
    system,
    runtime,
  })) {
    yield c;
  }
}

export async function* runEmbeddedAgentStream(ctx: EmbeddedAgentContext): AsyncGenerator<string> {
  const { request, runtime, modelId } = ctx;
  const snap = request.workspaceSnapshot;

  const specialistBase: SpecialistParams = {
    request,
    runtime,
    modelId,
    workspaceSnapshot: snap,
  };

  if (runtime.kind === "anthropic_env") {
    try {
      const decision = await completeAnthropicWithTools(
        buildOrchestratorSystem(request),
        historyToAnthropicMessages(request.conversationHistory, request.message),
        ORCHESTRATOR_ROUTING_TOOLS,
        runtime.apiKey,
        runtime.model,
      );

      if (decision.kind === "tool_use" && decision.name === "route_to_builder") {
        const reqText = String((decision.input as { request?: string }).request ?? request.message);
        yield* streamWidgetBuilder({ ...specialistBase, userRequest: reqText });
        return;
      }
      if (decision.kind === "tool_use" && decision.name === "route_to_context") {
        const q = String((decision.input as { question?: string }).question ?? request.message);
        yield* streamWorkspaceContext({ ...specialistBase, question: q });
        return;
      }
      if (decision.kind === "text") {
        yield* chunkText(decision.text || "");
        return;
      }
    } catch {
      /* fall through to heuristic */
    }
  }

  const h = heuristicRoute(request.message);
  if (h.tag === "builder") {
    yield* streamWidgetBuilder({ ...specialistBase, userRequest: h.request });
    return;
  }
  if (h.tag === "context") {
    yield* streamWorkspaceContext({ ...specialistBase, question: h.question });
    return;
  }
  yield* streamDirectAnswer(runtime, modelId, request.conversationHistory, request.message);
}
