/**
 * OpenRouter (and similar) reject requests when prompt + history exceeds the model
 * context window (often 128k tokens). Very long prior assistant replies — e.g. pasted
 * tables, HTML dashboards, or huge markdown — dominate input size. These caps keep
 * text chat within a conservative budget while preserving the most recent turns.
 */

import {
  openRouterModelContextWindow,
} from "./openrouter-profile-utils.js";

export const OPENROUTER_MAX_CHARS_PER_HISTORY_TURN = 10_000;
export const OPENROUTER_MAX_USER_MESSAGE_CHARS = 32_000;
/** Sum of (clipped) user+assistant history content only — leaves room for system + overhead. */
export const OPENROUTER_MAX_TOTAL_HISTORY_CHARS = 160_000;

function budgetForModel(model: string): {
  maxHistoryTurnChars: number;
  maxUserChars: number;
  maxTotalHistoryChars: number;
  maxSystemChars: number;
} {
  const win = openRouterModelContextWindow(model);
  if (win <= 32_768) {
    return {
      maxHistoryTurnChars: 4_000,
      maxUserChars: 8_000,
      maxTotalHistoryChars: 18_000,
      maxSystemChars: 36_000,
    };
  }
  if (win <= 64_000) {
    return {
      maxHistoryTurnChars: 6_000,
      maxUserChars: 16_000,
      maxTotalHistoryChars: 48_000,
      maxSystemChars: 72_000,
    };
  }
  return {
    maxHistoryTurnChars: OPENROUTER_MAX_CHARS_PER_HISTORY_TURN,
    maxUserChars: OPENROUTER_MAX_USER_MESSAGE_CHARS,
    maxTotalHistoryChars: OPENROUTER_MAX_TOTAL_HISTORY_CHARS,
    maxSystemChars: 120_000,
  };
}

function clipWithNotice(content: string, maxChars: number, label: string): string {
  if (content.length <= maxChars) return content;
  const omitted = content.length - maxChars;
  return `${content.slice(0, maxChars)}\n\n…[${label}: ${omitted} characters omitted for context limit]`;
}

export function clipOpenRouterHistoryTurn(content: string, model?: string): string {
  const max = model ? budgetForModel(model).maxHistoryTurnChars : OPENROUTER_MAX_CHARS_PER_HISTORY_TURN;
  return clipWithNotice(content, max, "Earlier message body");
}

export function clipOpenRouterUserMessage(content: string, model?: string): string {
  const max = model ? budgetForModel(model).maxUserChars : OPENROUTER_MAX_USER_MESSAGE_CHARS;
  return clipWithNotice(content, max, "User message");
}

export function clipOpenRouterSystemPrompt(content: string, model: string): string {
  const max = budgetForModel(model).maxSystemChars;
  return clipWithNotice(content, max, "System prompt");
}

export function applyOpenRouterHistoryBudget<T extends { role: "user" | "assistant"; content: string }>(
  recentRows: readonly T[],
  model?: string,
): T[] {
  const totalCap = model ? budgetForModel(model).maxTotalHistoryChars : OPENROUTER_MAX_TOTAL_HISTORY_CHARS;
  const mapped = recentRows.map((r) => ({
    ...r,
    content: clipOpenRouterHistoryTurn(r.content, model),
  }));
  let total = mapped.reduce((s, r) => s + r.content.length, 0);
  let start = 0;
  while (total > totalCap && start < mapped.length) {
    total -= mapped[start]!.content.length;
    start++;
  }
  return mapped.slice(start);
}

/** Trim system + history + user before OpenRouter chat/completions (model-aware). */
export function prepareOpenRouterTextChat(args: {
  model: string;
  system: string;
  userMessage: string;
  recentRows: Array<{ role: "user" | "assistant"; content: string }>;
}): {
  system: string;
  userMessage: string;
  recentRows: Array<{ role: "user" | "assistant"; content: string }>;
} {
  return {
    system: clipOpenRouterSystemPrompt(args.system, args.model),
    userMessage: clipOpenRouterUserMessage(args.userMessage, args.model),
    recentRows: applyOpenRouterHistoryBudget(args.recentRows, args.model),
  };
}
