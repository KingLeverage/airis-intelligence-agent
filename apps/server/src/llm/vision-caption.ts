import { getVisionCaptionModel } from "../config.js";
import { resolveOpenAiCompatAuth } from "./openai-compatible-auth.js";

const PROMPT =
  "Describe this image in 2–4 short sentences for a document search index. Mention subjects, visible text, charts, or UI. No preamble.";

function completionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function stripUndefined(h: Record<string, string | undefined>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v !== undefined && v !== "") o[k] = v;
  }
  return o;
}

/**
 * Vision caption via OpenAI-compatible `chat/completions` (image as data URL).
 */
export async function captionImageBase64(
  userId: string,
  opts: { base64: string; mime: string },
): Promise<string | null> {
  const model = getVisionCaptionModel();
  if (!model) return null;
  const auth = await resolveOpenAiCompatAuth(userId);
  if (!auth) return null;
  const mime = opts.mime.includes("/") ? opts.mime : "image/png";
  const dataUrl = `data:${mime};base64,${opts.base64}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${auth.apiKey}`,
    ...stripUndefined(auth.extraHeaders ?? {}),
  };

  const res = await fetch(completionsUrl(auth.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`vision caption HTTP ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text.slice(0, 4000) : null;
}
