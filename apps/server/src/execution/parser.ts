import {
  EXECUTION_END,
  findNextExecutionFenceStart,
  MAX_EXECUTION_BLOCK_CHARS,
  stripExecutionFences,
} from "@airis/shared";
import type { ParsedExecutionBlock } from "@airis/shared";
import { ParsedExecutionBlockSchema, WidgetKindSchema } from "@airis/shared";

/** Models often put `widgetKind` only inside JSON; headers may omit it. */
function coalesceWidgetKind(header: string | undefined, payload: Record<string, unknown>): string | undefined {
  const cands: unknown[] = [header, payload.widgetKind, payload.kind];
  for (const c of cands) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (!t) continue;
    const p = WidgetKindSchema.safeParse(t);
    if (p.success) return p.data;
  }
  return undefined;
}

export { stripExecutionFences };

export type ParseBlockResult =
  | { ok: true; block: ParsedExecutionBlock }
  | { ok: false; error: string };

export function extractBlockInners(fullText: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (true) {
    const fence = findNextExecutionFenceStart(fullText, i);
    if (!fence) break;
    const { start, marker } = fence;
    const end = fullText.indexOf(EXECUTION_END, start + marker.length);
    if (end === -1) break;
    const inner = fullText.slice(start + marker.length, end).trim();
    if (inner.length > MAX_EXECUTION_BLOCK_CHARS) {
      blocks.push(inner.slice(0, MAX_EXECUTION_BLOCK_CHARS));
    } else {
      blocks.push(inner);
    }
    i = end + EXECUTION_END.length;
  }
  return blocks;
}

export function parseBlockInner(inner: string): ParseBlockResult {
  const lines = inner.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let payloadLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^payload\s*:/i.test(t)) {
      payloadLineIndex = i;
      break;
    }
    const idx = t.indexOf(":");
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    headers[k] = v;
  }
  if (payloadLineIndex === -1) return { ok: false, error: "missing_payload_section" };

  let jsonPart = lines[payloadLineIndex].replace(/^\s*payload\s*:\s*/i, "").trim();
  if (lines.length > payloadLineIndex + 1) {
    jsonPart += "\n" + lines.slice(payloadLineIndex + 1).join("\n");
  }
  jsonPart = jsonPart.trim();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(jsonPart) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "invalid_payload_json" };
  }

  const type = headers.type;
  if (!type) return { ok: false, error: "missing_type_header" };

  const parseTargetId = (v: string): string | undefined => {
    const s = v.trim();
    if (!s) return undefined;
    if (/^e\d+$/i.test(s)) return s.toLowerCase();
    const n = Number(s);
    if (Number.isInteger(n) && n >= 0) return `e${n}`;
    return s;
  };

  let targetId: string | undefined;
  if (headers.targetId?.trim()) {
    targetId = parseTargetId(headers.targetId);
  } else if (typeof payload.targetId === "number") {
    targetId = `e${payload.targetId}`;
  } else if (typeof payload.targetId === "string") {
    targetId = parseTargetId(payload.targetId);
  }

  const widgetKind = coalesceWidgetKind(headers.widgetKind, payload);
  const title =
    (typeof headers.title === "string" && headers.title.trim()) ||
    (typeof payload.title === "string" ? payload.title.trim() : undefined) ||
    (typeof payload.name === "string" ? payload.name.trim() : undefined);
  const widgetIdRaw =
    (typeof headers.widgetId === "string" && headers.widgetId.trim()) ||
    (typeof payload.widgetId === "string" ? payload.widgetId.trim() : undefined);

  const merged = {
    type: typeof type === "string" ? type.trim() : type,
    widgetKind,
    title,
    widgetId: widgetIdRaw,
    targetSpace: headers.targetSpace as "current" | undefined,
    targetId,
    text: headers.text ?? (typeof payload.text === "string" ? payload.text : undefined),
    url: headers.url ?? (typeof payload.url === "string" ? payload.url : undefined),
    payload,
  };

  const p = ParsedExecutionBlockSchema.safeParse(merged);
  if (!p.success) return { ok: false, error: p.error.message };
  return { ok: true, block: p.data };
}

export function parseAllExecutionBlocks(fullText: string): ParseBlockResult[] {
  return extractBlockInners(fullText).map(parseBlockInner);
}

/** This chat phase uses at most one execution block; extra blocks are ignored for dispatch. */
export function parseFirstExecutionBlock(fullText: string): ParseBlockResult | null {
  const inners = extractBlockInners(fullText);
  if (inners.length === 0) return null;
  return parseBlockInner(inners[0]);
}
