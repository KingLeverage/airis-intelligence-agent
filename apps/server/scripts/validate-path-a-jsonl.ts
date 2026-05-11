/**
 * Path A SFT row validator (matches AIRIS inference contract).
 *
 * Each JSONL line:
 * - `system` — full system string (BASE + registry + transient JSON, etc.)
 * - `history` — only { role: "user"|"assistant", content } turns. Assistant
 *   contents must be prose-only (no <<<EXECUTION fences), as in persisted chat.
 * - `user` — final user message for the turn.
 * - `assistant_raw` — training label: prose + optional <<<EXECUTION … >>>END blocks.
 *
 * Usage (from repo root):
 *   npm run sft:validate-path-a -- examples/sft/path-a.example.jsonl
 *   npm run sft:validate-path-a -- ../../examples/sft/path-a.example.jsonl
 */
import { createReadStream, existsSync } from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { validatePathARow, type PathARow } from "./lib/path-a-row-validate.js";

function resolveJsonlPath(arg: string): string | null {
  if (path.isAbsolute(arg) && existsSync(arg)) return arg;
  const candidates = [
    arg,
    path.join(process.cwd(), arg),
    path.join(process.cwd(), "..", "..", arg),
    path.join(process.cwd(), "..", arg),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: tsx scripts/validate-path-a-jsonl.ts <file.jsonl>");
    process.exit(2);
  }
  const file = resolveJsonlPath(fileArg);
  if (!file) {
    console.error(`File not found: ${fileArg}`);
    process.exit(2);
  }

  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let lineNo = 0;
  let ok = 0;
  let fail = 0;
  for await (const line of rl) {
    lineNo += 1;
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    let row: PathARow;
    try {
      row = JSON.parse(t) as PathARow;
    } catch (e) {
      console.error(`line ${lineNo}: invalid JSON`, e);
      fail += 1;
      continue;
    }
    const err = validatePathARow(row, lineNo);
    if (err) {
      console.error(err);
      fail += 1;
    } else {
      ok += 1;
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
