import type { ParsedExecutionBlock } from "@airis/shared";
import { extractBlockInners, parseBlockInner, stripExecutionFences } from "./parser.js";

export type ModelParseOutcome = {
  assistantText: string;
  block?: ParsedExecutionBlock;
  parseError?: string;
};

export type ModelParseOutcomeMulti = {
  assistantText: string;
  blocks: ParsedExecutionBlock[];
  parseError?: string;
};

/**
 * Parse every `<<<EXECUTION` … `>>>END` fence in order. Malformed block → parseError.
 */
export function parseModelResponseMulti(raw: string): ModelParseOutcomeMulti {
  const assistantText = stripExecutionFences(raw).trim() || raw.trim();
  const inners = extractBlockInners(raw);
  if (inners.length === 0) return { assistantText, blocks: [] };
  const blocks: ParsedExecutionBlock[] = [];
  for (const inner of inners) {
    const r = parseBlockInner(inner);
    if (!r.ok) return { assistantText, blocks: [], parseError: r.error };
    blocks.push(r.block);
  }
  return { assistantText, blocks };
}

/**
 * Split model output into user-visible text and the first execution block (compat).
 */
export function parseModelResponse(raw: string): ModelParseOutcome {
  const multi = parseModelResponseMulti(raw);
  if (multi.parseError) return { assistantText: multi.assistantText, parseError: multi.parseError };
  return { assistantText: multi.assistantText, block: multi.blocks[0] };
}
