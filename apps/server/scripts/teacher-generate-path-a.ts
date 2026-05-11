/**
 * Teacher (OpenAI-compatible) → Path A JSONL rows. **Secrets:** only env vars — never commit keys or raw outputs with keys.
 *
 * Required: `AIRIS_TEACHER_API_KEY`
 * Optional: `AIRIS_TEACHER_BASE_URL` (default `https://api.openai.com/v1`),
 *           `AIRIS_TEACHER_MODEL` (default `gpt-4o-mini`),
 *           `AIRIS_TEACHER_OUT` (default `examples/sft/generated/teacher-out.jsonl` relative to repo when cwd is `apps/server`)
 *
 * Usage:
 *   npm run sft:teacher-path-a -w @airis/server -- --count 3
 */
import { appendFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { buildSyntheticTeacherExecutionAppendix } from "@airis/shared";
import { validatePathARow, type PathARow } from "./lib/path-a-row-validate.js";

const DEFAULT_TASKS = [
  "Add a note widget titled ‘Sprint’ with body ‘Ship Path A validation’.",
  "Compose the crypto-dashboard recipe for this space.",
  "Create a metric-grid titled ‘KPIs’ with two metrics: ARR $1M up, NRR 115% flat.",
  "Navigate the workspace browser to https://www.wikipedia.org/ then summarize in prose only (no widget).",
];

function parseArgs(): { count: number; out: string } {
  const argv = process.argv.slice(2);
  let count = 1;
  let out = process.env.AIRIS_TEACHER_OUT ?? "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count" && argv[i + 1]) {
      count = Math.max(1, Math.min(500, Number(argv[i + 1]) || 1));
      i += 1;
    } else if (argv[i] === "--out" && argv[i + 1]) {
      out = argv[i + 1]!;
      i += 1;
    }
  }
  if (!out.trim()) {
    out = path.join(process.cwd(), "..", "..", "examples", "sft", "generated", "teacher-out.jsonl");
  }
  return { count, out: path.resolve(out) };
}

async function callTeacherJson(userContent: string): Promise<PathARow> {
  const apiKey = process.env.AIRIS_TEACHER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("AIRIS_TEACHER_API_KEY is required (never hardcode secrets in source).");
  }
  const base = (process.env.AIRIS_TEACHER_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AIRIS_TEACHER_MODEL ?? "gpt-4o-mini";
  const appendix = buildSyntheticTeacherExecutionAppendix();
  const system = [
    "You emit **one JSON object only** (no markdown fences) with keys:",
    "`schema_version` (number 1), `system` (string), `history` (array of {role,user|assistant,content}),",
    "`user` (string), `assistant_raw` (string).",
    "",
    "Rules:",
    "- `history` assistant messages: prose only, **no** <<<EXECUTION or <<<EXECUTE blocks.",
    "- `assistant_raw`: final model turn = prose + optional valid fenced execution blocks per appendix.",
    "- Use realistic UUIDs in runtime JSON when you reference widgetId.",
    "",
    appendix,
  ].join("\n");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`teacher_http_${res.status}: ${rawText.slice(0, 600)}`);
  }
  const data = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("teacher_empty_content");
  }
  return JSON.parse(content) as PathARow;
}

async function main() {
  const { count, out } = parseArgs();
  await mkdir(path.dirname(out), { recursive: true });
  const tasks = DEFAULT_TASKS;
  let written = 0;
  for (let i = 0; i < count; i++) {
    const task = tasks[i % tasks.length]!;
    const prompt = [
      `Generate one Path A training row for this user goal:\n\n${task}`,
      "",
      "Include a plausible `system` string with a fenced Runtime context JSON block.",
    ].join("\n");
    try {
      const row = await callTeacherJson(prompt);
      const err = validatePathARow(row, `teacher_sample_${i + 1}`);
      if (err) {
        console.error(err);
        continue;
      }
      await appendFile(out, `${JSON.stringify(row)}\n`, "utf8");
      written += 1;
      console.log(`ok sample ${i + 1} -> ${out}`);
    } catch (e) {
      console.error(e);
    }
  }
  console.log(`Done. appended ${written}/${count} valid rows to ${out}`);
  process.exit(written === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
