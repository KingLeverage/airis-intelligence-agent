import type { ParsedExecutionBlock } from "@airis/shared";

export function normalizeTargetIdString(s: string): string {
  const t = s.trim();
  if (/^e\d+$/i.test(t)) return t.toLowerCase();
  const n = Number(t);
  if (Number.isInteger(n) && n >= 0) return `e${n}`;
  return t;
}

export function resolveExecutionTargetId(block: ParsedExecutionBlock): string | undefined {
  if (typeof block.targetId === "string" && block.targetId.trim()) {
    return normalizeTargetIdString(block.targetId);
  }
  const p = block.payload.targetId;
  if (typeof p === "number") return `e${p}`;
  if (typeof p === "string") return normalizeTargetIdString(p);
  return undefined;
}
