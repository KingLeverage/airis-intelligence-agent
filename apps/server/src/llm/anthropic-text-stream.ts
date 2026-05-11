/**
 * Plain Anthropic Messages API streaming (text deltas only).
 * Shared by main chat streaming and embedded agent specialists.
 */
export async function* streamAnthropicTextStream(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  apiKey: string,
  model: string,
): AsyncGenerator<string> {
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
      stream: true,
      system,
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`anthropic_stream_${res.status}: ${err.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const json = t.slice(5).trim();
      if (json === "[DONE]") continue;
      try {
        const ev = JSON.parse(json) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (ev.type === "content_block_delta" && ev.delta?.text) {
          yield ev.delta.text;
        }
      } catch {
        /* ignore partial */
      }
    }
  }
}
