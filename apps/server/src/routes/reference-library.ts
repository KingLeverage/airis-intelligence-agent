import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import { DEFAULT_USER_ID } from "../config.js";
import {
  absoluteBlobPath,
  getReferenceEntry,
  ingestReferenceBlob,
  listReferenceEntries,
  searchReferenceLibrary,
} from "../persistence/reference-library-store.js";
import { hybridSearchReferenceLibrary, reindexAllReferenceEmbeddings } from "../persistence/reference-library-rag.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const MAX_SEND = 25 * 1024 * 1024;

function summarizeEntry(e: {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  ingestedAt: string;
  title?: string;
  tags: string[];
  caption?: string;
}) {
  return {
    id: e.id,
    originalName: e.originalName,
    mime: e.mime,
    size: e.size,
    ingestedAt: e.ingestedAt,
    title: e.title,
    tags: e.tags,
    caption: e.caption,
  };
}

export async function registerReferenceLibraryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/reference-library", async (_req, reply) => {
    const entries = await listReferenceEntries(DEFAULT_USER_ID);
    return reply.send(apiOk({ entries: entries.map(summarizeEntry) }));
  });

  app.get("/api/reference-library/search", async (req, reply) => {
    const q = typeof (req.query as { q?: unknown }).q === "string" ? (req.query as { q: string }).q : "";
    const mode = typeof (req.query as { mode?: unknown }).mode === "string" ? (req.query as { mode: string }).mode : "";
    const hits =
      mode === "keyword"
        ? await searchReferenceLibrary(q.trim(), DEFAULT_USER_ID)
        : await hybridSearchReferenceLibrary(q.trim(), DEFAULT_USER_ID);
    return reply.send(
      apiOk({
        hits: hits.map((h) => ({
          ...summarizeEntry(h.entry),
          score: h.score,
          snippet: h.snippet,
        })),
      }),
    );
  });

  app.post("/api/reference-library/ingest", async (req, reply) => {
    let buffer: Buffer | null = null;
    let filename = "upload.bin";
    let mime = "application/octet-stream";
    let title: string | undefined;
    let caption: string | undefined;
    let tagsRaw = "";
    let autoCaption = false;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          if (buffer != null) {
            return reply.code(400).send(apiErr("too_many_files", "Send a single file field named `file`."));
          }
          filename = part.filename || "upload.bin";
          mime = part.mimetype || "application/octet-stream";
          buffer = await part.toBuffer();
        } else {
          const k = part.fieldname;
          const v = typeof part.value === "string" ? part.value : String(part.value ?? "");
          if (k === "title") title = v;
          else if (k === "caption") caption = v;
          else if (k === "tags") tagsRaw = v;
          else if (k === "autoCaption") autoCaption = v === "1" || v.toLowerCase() === "true";
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send(apiErr("multipart_error", msg));
    }

    if (buffer == null || buffer.length === 0) {
      return reply.code(400).send(apiErr("missing_file", "Include multipart file field `file`."));
    }

    const tags = tagsRaw
      .split(/[,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const entry = await ingestReferenceBlob(
      { buffer, originalName: filename, mime, title, tags, caption, autoCaption },
      DEFAULT_USER_ID,
    );
    return reply.send(apiOk({ entry: summarizeEntry(entry) }));
  });

  app.post("/api/reference-library/reindex-embeddings", async (_req, reply) => {
    const result = await reindexAllReferenceEmbeddings(DEFAULT_USER_ID);
    return reply.send(apiOk(result));
  });

  app.get("/api/reference-library/:id/file", async (req, reply) => {
    const id = (req.params as { id?: string }).id;
    if (!id) return reply.code(400).send(apiErr("missing_id", "id required"));
    const entry = await getReferenceEntry(id, DEFAULT_USER_ID);
    if (!entry) return reply.code(404).send(apiErr("not_found", "Unknown reference id"));
    const abs = absoluteBlobPath(DEFAULT_USER_ID, entry);
    let data: Buffer;
    try {
      data = await fs.readFile(abs);
    } catch {
      return reply.code(404).send(apiErr("blob_missing", "File missing on disk"));
    }
    if (data.byteLength > MAX_SEND) {
      return reply.code(413).send(apiErr("too_large", "File exceeds download limit"));
    }
    const asciiName = entry.originalName.replace(/[^\x20-\x7E]/g, "_").slice(0, 180) || "file";
    return reply
      .header("Content-Type", entry.mime)
      .header("Content-Disposition", `inline; filename="${asciiName}"`)
      .send(data);
  });
}
