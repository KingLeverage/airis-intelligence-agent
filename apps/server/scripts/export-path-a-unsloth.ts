/**
 * Convert Path A JSONL (`system`, `history`, `user`, `assistant_raw`) into JSONL lines
 * with a single `text` field for trainers that expect one column (e.g. Unsloth examples).
 *
 * Delimiter format **v1** (plain tags — replace with your base model’s official template if needed):
 *
 * ```
 * [SYSTEM]
 * {system}
 *
 * [USER]
 * {history user 1}
 *
 * [ASSISTANT]
 * {history assistant 1}
 * ...
 * [USER]
 * {user}
 *
 * [ASSISTANT]
 * {assistant_raw}
 * ```
 *
 * Usage:
 *   npm run sft:export-unsloth -w @airis/server -- in.jsonl out.jsonl
 */
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import type { PathARow } from "./lib/path-a-row-validate.js";

function resolvePath(arg: string): string | null {
  if (path.isAbsolute(arg) && existsSync(arg)) return arg;
  const candidates = [arg, path.join(process.cwd(), arg), path.join(process.cwd(), "..", "..", arg)];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function formatV1(row: PathARow): string {
  const parts: string[] = [];
  parts.push(`[SYSTEM]\n${typeof row.system === "string" ? row.system : ""}`);
  for (const m of row.history ?? []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    parts.push(`[${m.role.toUpperCase()}]\n${m.content}`);
  }
  parts.push(`[USER]\n${typeof row.user === "string" ? row.user : ""}`);
  parts.push(`[ASSISTANT]\n${typeof row.assistant_raw === "string" ? row.assistant_raw : ""}`);
  return parts.join("\n\n");
}

async function main() {
  const inArg = process.argv[2];
  const outArg = process.argv[3];
  if (!inArg || !outArg) {
    console.error("Usage: tsx scripts/export-path-a-unsloth.ts <in.jsonl> <out.jsonl>");
    process.exit(2);
  }
  const inPath = resolvePath(inArg);
  if (!inPath) {
    console.error(`Input not found: ${inArg}`);
    process.exit(2);
  }
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg);
  await mkdir(path.dirname(outPath), { recursive: true });
  const rl = readline.createInterface({ input: createReadStream(inPath), crlfDelay: Infinity });
  const out = createWriteStream(outPath, { flags: "w" });
  let n = 0;
  for await (const line of rl) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    let row: PathARow;
    try {
      row = JSON.parse(t) as PathARow;
    } catch {
      console.error("skip invalid json line");
      continue;
    }
    const text = formatV1(row);
    out.write(`${JSON.stringify({ text, schema_version: row.schema_version ?? 1 })}\n`);
    n += 1;
  }
  out.end();
  await once(out, "finish");
  console.log(`Wrote ${n} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
