import { getEmbeddingModel } from "../config.js";
import { createTextEmbedding } from "../llm/embedding-client.js";
import { writeEntryEmbedding } from "./reference-library-vectors.js";

/** Minimal fields needed to build an embedding (avoids circular import with `reference-library-store`). */
export type ReferenceEntryEmbedSource = {
  id: string;
  title?: string;
  tags: string[];
  caption?: string;
  textExtract?: string;
};

export function compositeTextForEmbedding(e: ReferenceEntryEmbedSource): string {
  const parts = [e.title, e.tags?.length ? e.tags.join(", ") : "", e.caption, e.textExtract].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  return parts.join("\n\n").trim().slice(0, 16_000);
}

/**
 * Writes `files/<id>/embedding.json` when `AIRIS_EMBEDDING_MODEL` and API keys are configured.
 */
export async function persistReferenceEmbedding(userId: string, e: ReferenceEntryEmbedSource): Promise<boolean> {
  if (!getEmbeddingModel()) return false;
  const text = compositeTextForEmbedding(e);
  if (text.length < 24) return false;
  const vec = await createTextEmbedding(userId, text);
  if (!vec?.length) return false;
  const model = getEmbeddingModel()!;
  await writeEntryEmbedding(userId, e.id, model, vec);
  return true;
}
