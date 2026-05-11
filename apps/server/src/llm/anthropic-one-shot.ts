/**
 * Single non-streaming Anthropic Messages completion (small utility calls).
 */

export async function completeAnthropicOneShot(args: {
  system: string;
  user: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens ?? 4096,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
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
