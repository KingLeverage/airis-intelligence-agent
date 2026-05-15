import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

/** Per-absolute-path write queue. Each entry chains the next write off the previous one. */
const __writeLocks = new Map<string, Promise<void>>();
const __writeWaiters = new Map<string, number>();

async function withWriteLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const key = path.resolve(file);
  const prev = __writeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => mine);
  __writeLocks.set(key, chained);

  const depth = (__writeWaiters.get(key) ?? 0) + 1;
  __writeWaiters.set(key, depth);
  if (depth >= 2) {
    console.warn("[fs-utils] write contention", { file: key, depth });
  }

  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (__writeLocks.get(key) === chained) {
      __writeLocks.delete(key);
    }
    const n = (__writeWaiters.get(key) ?? 1) - 1;
    if (n <= 0) {
      __writeWaiters.delete(key);
    } else {
      __writeWaiters.set(key, n);
    }
  }
}

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
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await withWriteLock(file, async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, file);
  });
}

export async function atomicWriteText(file: string, text: string): Promise<void> {
  await ensureDir(path.dirname(file));
  await withWriteLock(file, async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, file);
  });
}

export async function atomicWriteBuffer(file: string, data: Buffer): Promise<void> {
  await ensureDir(path.dirname(file));
  await withWriteLock(file, async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
  });
}

export async function appendJsonl(file: string, line: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const body = `${JSON.stringify(line)}\n`;
  await withWriteLock(file, async () => {
    await fs.appendFile(file, body, "utf8");
  });
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
