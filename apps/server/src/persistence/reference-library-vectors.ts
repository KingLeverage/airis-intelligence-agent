import path from "node:path";
import { z } from "zod";
import { atomicWriteJson, readJsonWithSchema, readTextIfExists } from "./fs-utils.js";
import { referenceLibraryRoot } from "./paths.js";

const SidecarSchema = z.object({
  model: z.string(),
  dims: z.number().int().positive(),
  vector: z.array(z.number()),
});

export type StoredEmbedding = z.infer<typeof SidecarSchema>;

export function embeddingSidecarPath(entryId: string, userId: string): string {
  return path.join(referenceLibraryRoot(userId), "files", entryId, "embedding.json");
}

export async function writeEntryEmbedding(
  userId: string,
  entryId: string,
  model: string,
  vector: number[],
): Promise<void> {
  const payload: StoredEmbedding = { model, dims: vector.length, vector };
  await atomicWriteJson(embeddingSidecarPath(entryId, userId), payload);
}

export async function readEntryEmbedding(
  userId: string,
  entryId: string,
): Promise<StoredEmbedding | null> {
  const p = embeddingSidecarPath(entryId, userId);
  const r = await readJsonWithSchema(p, SidecarSchema);
  if (r.ok) return r.data;
  return null;
}

export async function hasEntryEmbedding(userId: string, entryId: string): Promise<boolean> {
  const t = await readTextIfExists(embeddingSidecarPath(entryId, userId));
  return t != null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
