/**
 * OpenRouter (and similar) reject requests when prompt + history exceeds the model
 * context window (often 128k tokens). Very long prior assistant replies — e.g. pasted
 * tables, HTML dashboards, or huge markdown — dominate input size. These caps keep
 * text chat within a conservative budget while preserving the most recent turns.
 */

export const OPENROUTER_MAX_CHARS_PER_HISTORY_TURN = 10_000;
export const OPENROUTER_MAX_USER_MESSAGE_CHARS = 32_000;
/** Sum of (clipped) user+assistant history content only — leaves room for system + overhead. */
export const OPENROUTER_MAX_TOTAL_HISTORY_CHARS = 160_000;

function clipWithNotice(content: string, maxChars: number, label: string): string {
  if (content.length <= maxChars) return content;
  const omitted = content.length - maxChars;
  return `${content.slice(0, maxChars)}\n\n…[${label}: ${omitted} characters omitted for context limit]`;
}

export function clipOpenRouterHistoryTurn(content: string): string {
  return clipWithNotice(content, OPENROUTER_MAX_CHARS_PER_HISTORY_TURN, "Earlier message body");
}

export function clipOpenRouterUserMessage(content: string): string {
  return clipWithNotice(content, OPENROUTER_MAX_USER_MESSAGE_CHARS, "User message");
}

export function applyOpenRouterHistoryBudget<T extends { role: "user" | "assistant"; content: string }>(
  recentRows: readonly T[],
): T[] {
  const mapped = recentRows.map((r) => ({
    ...r,
    content: clipOpenRouterHistoryTurn(r.content),
  }));
  let total = mapped.reduce((s, r) => s + r.content.length, 0);
  let start = 0;
  while (total > OPENROUTER_MAX_TOTAL_HISTORY_CHARS && start < mapped.length) {
    total -= mapped[start]!.content.length;
    start++;
  }
  return mapped.slice(start);
}
