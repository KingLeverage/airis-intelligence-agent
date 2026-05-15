import { EXECUTION_TYPES } from "../constants/executionTypes.js";
import {
  EXECUTION_END,
  EXECUTION_START,
  EXECUTION_START_EXECUTE,
  type ExecutionType,
} from "../protocol/execution.js";
import { WIDGET_KIND_DEFS } from "../widget-registry.js";

/**
 * Execution `type:` values the chat pipeline may apply (see server `validateChatPhaseExecution`).
 * Keep in sync with `apps/server/src/execution/validator.ts` — only these may appear in SFT `assistant_raw` for in-app chat.
 */
export const CHAT_PHASE_EXECUTION_TYPES = [
  "widget.create",
  "widget.createMany",
  "workspace.compose",
  "widget.update",
  "widget.move",
  "widget.resize",
  "widget.delete",
  "browser.navigate",
  "browser.click",
  "browser.type",
  "browser.scroll",
  "browser.back",
  "browser.evaluate",
  "space.create",
  "space.delete",
  "export.pdf",
  "cli.tool.run",
  "workflow.run",
] as const satisfies readonly ExecutionType[];

export type ChatPhaseExecutionType = (typeof CHAT_PHASE_EXECUTION_TYPES)[number];

const CHAT_PHASE_SET = new Set<string>(CHAT_PHASE_EXECUTION_TYPES);

export function isChatPhaseExecutionType(t: string): t is ChatPhaseExecutionType {
  return CHAT_PHASE_SET.has(t);
}

/** Non–chat-phase dispatcher types (do not emit in chat SFT unless product adds them to chat validation). */
export const NON_CHAT_PHASE_EXECUTION_TYPES: ExecutionType[] = EXECUTION_TYPES.filter(
  (t) => !CHAT_PHASE_SET.has(t),
);

/**
 * Markdown appendix for a **teacher** model generating Path A JSONL rows.
 * Paste after your base policy or merge into `system` when synthesizing data.
 */
export function buildSyntheticTeacherExecutionAppendix(): string {
  const widgetLines = Object.values(WIDGET_KIND_DEFS).map(
    (d) =>
      `- **${d.kind}** (${d.label}): ${d.description}\n  - Example \`payload\` JSON: \`${JSON.stringify(d.examplePayload)}\``,
  );

  return [
    "## AIRIS execution protocol (synthetic fine-tuning / Path A)",
    "",
    "### Output contract (Path A JSONL row)",
    "- `schema_version`: **1**",
    "- `system`: Full system string including a `## Runtime context` JSON block like production (`buildTransientContext`).",
    "- `history`: Only `{ role: \"user\" | \"assistant\", content }`. **Assistant `content` must be prose-only** — no execution fences (AIRIS strips fences before persisting chat).",
    "- `user`: Final user message for the turn.",
    "- `assistant_raw`: Training label = prose + zero or more **valid** fenced blocks (see below).",
    "",
    "### Fence grammar (this is the “tool” surface, not OpenAI `function_call`)",
    `- Opening: \`${EXECUTION_START}\` or \`${EXECUTION_START_EXECUTE}\` (alias, same inner format).`,
    `- Closing: \`${EXECUTION_END}\`.`,
    "- Inner body: line-oriented headers (`type:`, `widgetKind:`, `widgetId:`, `url:`, `title:`, …) then a line starting with `payload:` followed by a **single JSON object** (may span lines).",
    "",
    "### `type:` values allowed in chat-phase SFT (must match server validator)",
    ...CHAT_PHASE_EXECUTION_TYPES.map((t) => `- \`${t}\``),
    "",
    "### Dispatcher-only types (omit from chat SFT unless server enables them in chat)",
    ...NON_CHAT_PHASE_EXECUTION_TYPES.map((t) => `- \`${t}\``),
    "",
    "### Widget kinds + example payloads",
    ...widgetLines,
    "",
    "### Notes",
    "- `browser.evaluate` is gated at runtime (Playwright + env); synthetic rows may still include it for curriculum coverage.",
    "- Prefer real UUIDs for `widgetId` when simulating `widget.update` / `widget.delete` and align them with `Runtime context.widgets`.",
    "- After generation, run `npm run sft:validate-path-a -- <file.jsonl>` before training.",
  ].join("\n");
}
