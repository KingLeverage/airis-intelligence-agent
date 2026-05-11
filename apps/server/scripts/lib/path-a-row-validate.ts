import { stripExecutionFences } from "@airis/shared";
import { parseModelResponseMulti } from "../../src/execution/response-parser.js";
import { validateChatPhaseExecution } from "../../src/execution/validator.js";

export type PathAHistoryMsg = { role: string; content: string };

export type PathARow = {
  schema_version?: number;
  system?: string;
  history?: PathAHistoryMsg[];
  user?: string;
  assistant_raw?: string;
};

function validateHistory(history: PathAHistoryMsg[], lineLabel: string | number): string | null {
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (!m || typeof m.content !== "string") {
      return `line ${lineLabel}: history[${i}] missing content`;
    }
    if (m.role !== "user" && m.role !== "assistant") {
      return `line ${lineLabel}: history[${i}] role must be user or assistant, got ${String(m.role)}`;
    }
    if (m.role === "assistant") {
      const raw = m.content.trim();
      const stripped = stripExecutionFences(m.content).trim();
      if (raw !== stripped) {
        return `line ${lineLabel}: history assistant[${i}] must be prose-only (content must equal stripExecutionFences(content); AIRIS persists stripped text)`;
      }
    }
  }
  return null;
}

function validateAssistantRaw(raw: string, lineLabel: string | number): string | null {
  const parsed = parseModelResponseMulti(raw);
  if (parsed.parseError) {
    return `line ${lineLabel}: assistant_raw parse error: ${parsed.parseError}`;
  }
  for (let i = 0; i < parsed.blocks.length; i++) {
    const v = validateChatPhaseExecution(parsed.blocks[i]!);
    if (!v.ok) {
      return `line ${lineLabel}: block[${i}] rejected: ${v.message}`;
    }
  }
  return null;
}

/** Returns an error message or `null` if the row satisfies Path A + AIRIS parse/validate rules. */
export function validatePathARow(row: PathARow, lineLabel: string | number): string | null {
  if (row.schema_version !== 1) {
    return `line ${lineLabel}: schema_version must be 1`;
  }
  if (typeof row.system !== "string" || !row.system.trim()) {
    return `line ${lineLabel}: system must be a non-empty string`;
  }
  if (!Array.isArray(row.history)) {
    return `line ${lineLabel}: history must be an array`;
  }
  const hErr = validateHistory(row.history, lineLabel);
  if (hErr) return hErr;
  if (typeof row.user !== "string") {
    return `line ${lineLabel}: user must be a string`;
  }
  if (typeof row.assistant_raw !== "string") {
    return `line ${lineLabel}: assistant_raw must be a string`;
  }
  return validateAssistantRaw(row.assistant_raw, lineLabel);
}
