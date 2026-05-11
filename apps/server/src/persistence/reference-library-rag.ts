import { isReferenceRagPromptEnabled, getEmbeddingModel } from "../config.js";
import { createTextEmbedding } from "../llm/embedding-client.js";
import {
  listReferenceEntries,
  type ReferenceSearchHit,
  searchReferenceLibrary,
} from "./reference-library-store.js";
import { cosineSimilarity, readEntryEmbedding } from "./reference-library-vectors.js";
import { persistReferenceEmbedding } from "./reference-library-embed.js";

const MAX_RAG_CHARS = 4500;

function combineKeywordSemantic(kwNorm: number, sem: number, hasSidecar: boolean): number {
  if (!hasSidecar) return kwNorm;
  return 0.35 * kwNorm + 0.65 * sem;
}

/**
 * Keyword hits optionally re-ranked with stored embeddings.
 */
export async function hybridSearchReferenceLibrary(
  q: string,
  userId: string,
  limit = 12,
): Promise<ReferenceSearchHit[]> {
  const trimmed = q.trim();
  const kw = await searchReferenceLibrary(trimmed, userId, Math.max(limit * 4, 24));
  if (!getEmbeddingModel() || kw.length === 0) return kw.slice(0, limit);

  let qv: number[] | null = null;
  try {
    qv = await createTextEmbedding(userId, trimmed);
  } catch {
    qv = null;
  }
  if (!qv) return kw.slice(0, limit);

  const enriched: Array<ReferenceSearchHit & { hybrid: number }> = [];
  for (const h of kw) {
    const side = await readEntryEmbedding(userId, h.entry.id);
    let sem = 0;
    if (side && side.vector.length === qv.length) {
      const c = cosineSimilarity(qv, side.vector);
      sem = Math.max(0, Math.min(1, (c + 1) / 2));
    }
    const kwNorm = Math.min(1, h.score / Math.max(2, kw[0]?.score ?? 2));
    const hybrid = combineKeywordSemantic(kwNorm, sem, Boolean(side));
    enriched.push({ ...h, hybrid });
  }
  enriched.sort((a, b) => b.hybrid - a.hybrid || b.score - a.score);
  return enriched.slice(0, limit).map(({ hybrid: _h, ...rest }) => rest);
}

export async function reindexAllReferenceEmbeddings(
  userId: string,
): Promise<{ total: number; embedded: number; skipped: number }> {
  const entries = await listReferenceEntries(userId);
  let embedded = 0;
  let skipped = 0;
  for (const e of entries) {
    const ok = await persistReferenceEmbedding(userId, e).catch(() => false);
    if (ok) embedded++;
    else skipped++;
  }
  return { total: entries.length, embedded, skipped };
}

export async function buildReferenceLibraryRagMarkdown(userId: string, userMessage: string): Promise<string> {
  if (!isReferenceRagPromptEnabled()) return "";
  const q = userMessage.trim();
  if (q.length < 4) return "";

  const hits = await hybridSearchReferenceLibrary(q, userId, 8);
  if (hits.length === 0) return "";

  const lines: string[] = [
    "## Reference library (retrieved for this turn)",
    "Ground answers when relevant. Each item is user-ingested material (not executable code). Prefer citing `refId` in prose when you use a fact.",
    "",
  ];
  let used = 0;
  for (const h of hits) {
    const e = h.entry;
    const title = e.title || e.originalName;
    const body = [e.caption, e.textExtract].filter(Boolean).join("\n\n").trim();
    const excerpt = body.length > 900 ? `${body.slice(0, 900)}…` : body;
    const block = [
      `### ${title}`,
      `- **refId:** \`${e.id}\``,
      `- **tags:** ${e.tags.length ? e.tags.join(", ") : "—"}`,
      e.mime ? `- **mime:** ${e.mime}` : "",
      h.snippet ? `- **keyword snippet:** ${h.snippet.replace(/\s+/g, " ").trim()}` : "",
      excerpt ? `\n${excerpt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (used + block.length > MAX_RAG_CHARS) break;
    lines.push(block, "");
    used += block.length;
  }
  return `${lines.join("\n").trim()}\n`;
}
