import { z } from "zod";
import { WidgetKindSchema } from "../schemas/widget.js";

/** Canonical fence start (Space Agent–style: plain text + one marked block). */
export const EXECUTION_START = "<<<EXECUTION";
/** Token-efficient alias: same structured inner format as `EXECUTION_START`. */
export const EXECUTION_START_EXECUTE = "<<<EXECUTE";
/**
 * All accepted opening fences for the structured execution block (`type:` headers + `payload:` JSON).
 * Raw `browser.evaluate` runs **only** when the server enables Playwright plus `AIRIS_PERSONAL_BROWSER_EVAL=1`
 * (headless page context — see server docs). There is still no unconstrained JS in the React workspace.
 */
export const EXECUTION_FENCE_MARKERS: readonly string[] = [EXECUTION_START, EXECUTION_START_EXECUTE];

export const EXECUTION_END = ">>>END";
export const MAX_EXECUTION_BLOCK_CHARS = 64_000;

/** Earliest `EXECUTION_FENCE_MARKERS` match at or after `fromIndex`, or null. */
export function findNextExecutionFenceStart(
  fullText: string,
  fromIndex: number,
): { start: number; marker: string } | null {
  let best: { start: number; marker: string } | null = null;
  for (const marker of EXECUTION_FENCE_MARKERS) {
    const s = fullText.indexOf(marker, fromIndex);
    if (s === -1) continue;
    if (!best || s < best.start) best = { start: s, marker };
  }
  return best;
}

/**
 * Remove `<<<EXECUTION` / `<<<EXECUTE` … `>>>END` fences; leave plain assistant prose.
 * Matches what AIRIS persists in chat after a turn (server strips fences before `appendChatMessage`).
 */
export function stripExecutionFences(fullText: string): string {
  let out = "";
  let i = 0;
  while (true) {
    const fence = findNextExecutionFenceStart(fullText, i);
    if (!fence) {
      out += fullText.slice(i);
      break;
    }
    const { start, marker } = fence;
    out += fullText.slice(i, start);
    const end = fullText.indexOf(EXECUTION_END, start + marker.length);
    if (end === -1) {
      out += fullText.slice(start);
      break;
    }
    i = end + EXECUTION_END.length;
  }
  let trimmed = out.trim();
  trimmed = trimmed.replace(/\s*>>>END\s*$/i, "").trim();
  return trimmed;
}

export const ExecutionTypeSchema = z.enum([
  "widget.create",
  "widget.createMany",
  "workspace.compose",
  "widget.update",
  "widget.move",
  "widget.resize",
  "widget.delete",
  "layout.update",
  "browser.navigate",
  "browser.click",
  "browser.type",
  "browser.scroll",
  "browser.back",
  "browser.evaluate",
  "snapshot.create",
  "space.create",
  "space.delete",
  /** Server-generated binary PDF saved under the space `exports/` directory. */
  "export.pdf",
  /**
   * Run an allowlisted Printing Press–style CLI on the server (`AIRIS_CLI_TOOLS=1`).
   * Payload: `{ "toolKey": "…" }` for a catalog preset, or `{ "program": "coingecko-pp-cli", "argsText": "…" }` for custom argv.
   */
  "cli.tool.run",
]);

export type ExecutionType = z.infer<typeof ExecutionTypeSchema>;

/** Parsed header + JSON payload from one EXECUTION block */
export const ParsedExecutionBlockSchema = z.object({
  type: ExecutionTypeSchema,
  widgetKind: WidgetKindSchema.optional(),
  title: z.string().optional(),
  widgetId: z.string().uuid().optional(),
  targetSpace: z.enum(["current"]).optional(),
  /** Browser element id (e.g. e3) or legacy integer string from headers. */
  targetId: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  /** JSON object from the payload: section */
  payload: z.record(z.unknown()),
});

export type ParsedExecutionBlock = z.infer<typeof ParsedExecutionBlockSchema>;
