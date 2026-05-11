/**
 * Non-streaming Anthropic Messages call with tool definitions (orchestrator routing).
 */
export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type AnthropicMsg = { role: "user" | "assistant"; content: string };

export async function completeAnthropicWithTools(
  system: string,
  messages: AnthropicMsg[],
  tools: AnthropicToolDef[],
  apiKey: string,
  model: string,
): Promise<
  | { kind: "tool_use"; name: string; input: Record<string, unknown> }
  | { kind: "text"; text: string }
> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: false,
      system,
      tools,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`anthropic_tools_${res.status}: ${err.slice(0, 500)}`);
  }
  const body = (await res.json()) as {
    content?: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >;
    stop_reason?: string;
  };
  const blocks = body.content ?? [];
  for (const b of blocks) {
    if (b.type === "tool_use") {
      return { kind: "tool_use", name: b.name, input: b.input ?? {} };
    }
  }
  const text = blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { kind: "text", text };
}
