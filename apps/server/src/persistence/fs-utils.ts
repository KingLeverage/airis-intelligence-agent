import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readTextIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw e;
  }
}

export async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, file);
}

export async function atomicWriteText(file: string, text: string): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

export async function atomicWriteBuffer(file: string, data: Buffer): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export async function appendJsonl(file: string, line: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, `${JSON.stringify(line)}\n`, "utf8");
}

/** Parses one JSON value per non-empty line; lines that are not valid JSON are skipped (never throws). */
export function parseJsonl(content: string): unknown[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: unknown[] = [];
  for (const l of lines) {
    try {
      out.push(JSON.parse(l) as unknown);
    } catch {
      /* corrupt chat.jsonl line — same recovery stance as invalid widget files */
    }
  }
  return out;
}

export async function readJsonWithSchema<T extends z.ZodTypeAny>(
  file: string,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; error: string }> {
  const text = await readTextIfExists(file);
  if (text == null) return { ok: false, error: "missing_file" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.message };
  return { ok: true, data: r.data };
}

/** Alias for callers that prefer “validated read” wording. */
export const readValidatedJson = readJsonWithSchema;

export async function listSubdirectories(dir: string): Promise<string[]> {
  await ensureDir(dir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Basenames of `*.json` files in `dir` (not recursive). */
export async function listJsonFiles(dir: string): Promise<string[]> {
  await ensureDir(dir);
  const entries = await fs.readdir(dir);
  return entries.filter((f) => f.endsWith(".json"));
}
