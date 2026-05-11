import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { DEFAULT_USER_ID } from "../config.js";
import { captionImageBase64 } from "../llm/vision-caption.js";
import { getVisionCaptionModel } from "../config.js";
import { atomicWriteJson, ensureDir, readJsonWithSchema, readTextIfExists } from "./fs-utils.js";
import { persistReferenceEmbedding } from "./reference-library-embed.js";
import { extractPdfText } from "./pdf-text.js";
import { referenceLibraryBlobDir, referenceLibraryIndexFile, referenceLibraryRoot } from "./paths.js";

const MAX_TEXT_EXTRACT = 200_000;

export const ReferenceLibraryEntrySchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  /** Relative to `reference-library/` (e.g. `files/{id}/report.pdf`). */
  storedRelPath: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  ingestedAt: z.string(),
  title: z.string().optional(),
  tags: z.array(z.string()).default([]),
  caption: z.string().optional(),
  /** Searchable body for text-like uploads (capped). */
  textExtract: z.string().optional(),
});

export type ReferenceLibraryEntry = z.infer<typeof ReferenceLibraryEntrySchema>;

const ReferenceLibraryIndexSchema = z.object({
  version: z.literal(1),
  entries: z.array(ReferenceLibraryEntrySchema),
});

export type ReferenceLibraryIndex = z.infer<typeof ReferenceLibraryIndexSchema>;

const EMPTY_INDEX: ReferenceLibraryIndex = { version: 1, entries: [] };

export async function initReferenceLibrary(userId: string = DEFAULT_USER_ID): Promise<void> {
  await ensureDir(referenceLibraryRoot(userId));
  await ensureDir(path.join(referenceLibraryRoot(userId), "files"));
  const idx = referenceLibraryIndexFile(userId);
  if ((await readTextIfExists(idx)) == null) {
    await atomicWriteJson(idx, EMPTY_INDEX);
  }
}

async function readIndex(userId: string): Promise<ReferenceLibraryIndex> {
  const r = await readJsonWithSchema(referenceLibraryIndexFile(userId), ReferenceLibraryIndexSchema);
  if (!r.ok) return EMPTY_INDEX;
  return r.data;
}

async function writeIndex(userId: string, index: ReferenceLibraryIndex): Promise<void> {
  await atomicWriteJson(referenceLibraryIndexFile(userId), index);
}

export function safeStoredBasename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^\w.\-()+ ]/g, "_").trim() || "upload.bin";
  return base.slice(0, 200);
}

export async function listReferenceEntries(userId: string = DEFAULT_USER_ID): Promise<ReferenceLibraryEntry[]> {
  await initReferenceLibrary(userId);
  const idx = await readIndex(userId);
  return idx.entries;
}

export async function getReferenceEntry(
  id: string,
  userId: string = DEFAULT_USER_ID,
): Promise<ReferenceLibraryEntry | null> {
  const idx = await readIndex(userId);
  return idx.entries.find((e) => e.id === id) ?? null;
}

export function absoluteBlobPath(userId: string, entry: ReferenceLibraryEntry): string {
  return path.join(referenceLibraryRoot(userId), entry.storedRelPath);
}

export type ReferenceSearchHit = {
  entry: ReferenceLibraryEntry;
  score: number;
  snippet?: string;
};

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function haystackForEntry(e: ReferenceLibraryEntry): string {
  return [
    e.title ?? "",
    e.originalName,
    e.caption ?? "",
    e.tags.join(" "),
    e.textExtract ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

export async function searchReferenceLibrary(
  q: string,
  userId: string = DEFAULT_USER_ID,
  limit = 25,
): Promise<ReferenceSearchHit[]> {
  const tokens = tokenize(q);
  if (tokens.length === 0) return [];
  const idx = await readIndex(userId);
  const hits: ReferenceSearchHit[] = [];
  for (const e of idx.entries) {
    const hay = haystackForEntry(e);
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 1;
    }
    if (score <= 0) continue;
    let snippet: string | undefined;
    const te = e.textExtract;
    if (te && tokens[0]) {
      const pos = te.toLowerCase().indexOf(tokens[0]!);
      if (pos >= 0) {
        const start = Math.max(0, pos - 40);
        snippet = te.slice(start, start + 200).trim();
      }
    }
    hits.push({ entry: e, score, snippet });
  }
  hits.sort((a, b) => b.score - a.score || b.entry.ingestedAt.localeCompare(a.entry.ingestedAt));
  return hits.slice(0, limit);
}

export type IngestInput = {
  buffer: Buffer;
  originalName: string;
  mime: string;
  title?: string;
  tags: string[];
  caption?: string;
  /** When true and `AIRIS_VISION_CAPTION_MODEL` is set, caption images without user caption. */
  autoCaption?: boolean;
};

function isImageMime(mime: string, lowerName: string): boolean {
  if (mime.startsWith("image/")) return true;
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"].some((ext) =>
    lowerName.endsWith(ext),
  );
}

export async function ingestReferenceBlob(input: IngestInput, userId: string = DEFAULT_USER_ID): Promise<ReferenceLibraryEntry> {
  await initReferenceLibrary(userId);
  const id = uuid();
  const safeName = safeStoredBasename(input.originalName);
  const rel = path.join("files", id, safeName).replace(/\\/g, "/");
  const dir = referenceLibraryBlobDir(id, userId);
  await ensureDir(dir);
  const abs = path.join(dir, safeName);
  await fs.writeFile(abs, input.buffer);

  let textExtract: string | undefined;
  const lower = input.originalName.toLowerCase();
  const mime = input.mime.toLowerCase();
  if (
    mime.startsWith("text/") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".jsonl")
  ) {
    try {
      const raw = input.buffer.toString("utf8");
      textExtract = raw.length > MAX_TEXT_EXTRACT ? raw.slice(0, MAX_TEXT_EXTRACT) : raw;
    } catch {
      /* ignore */
    }
  }

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const pdfText = await extractPdfText(input.buffer);
    if (pdfText) {
      textExtract = pdfText.length > MAX_TEXT_EXTRACT ? pdfText.slice(0, MAX_TEXT_EXTRACT) : pdfText;
    }
  }

  let caption = input.caption?.trim() || undefined;
  if (
    input.autoCaption &&
    getVisionCaptionModel() &&
    isImageMime(mime, lower) &&
    !caption &&
    input.buffer.byteLength <= 6 * 1024 * 1024
  ) {
    try {
      const cap = await captionImageBase64(userId, {
        base64: input.buffer.toString("base64"),
        mime: input.mime || "image/png",
      });
      if (cap) caption = cap;
    } catch {
      /* vision optional */
    }
  }

  const entry: ReferenceLibraryEntry = {
    id,
    originalName: input.originalName,
    storedRelPath: rel,
    mime: input.mime || "application/octet-stream",
    size: input.buffer.byteLength,
    ingestedAt: new Date().toISOString(),
    title: input.title?.trim() || undefined,
    tags: input.tags,
    caption,
    textExtract,
  };

  const idx = await readIndex(userId);
  idx.entries.push(entry);
  await writeIndex(userId, idx);
  void persistReferenceEmbedding(userId, entry).catch(() => {});
  return entry;
}
