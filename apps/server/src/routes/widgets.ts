import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import * as store from "../persistence/space-store.js";
import { spaceExportPdfPath, spaceExportRasterPath, spaceExportsDir } from "../persistence/paths.js";
import { sanitizePdfFilename } from "../services/pdf/pdf-generation.js";
import {
  createWidgetForSpace,
  deleteWidgetForSpace,
  updateWidgetForSpace,
} from "../services/widgets/widget-mutations.js";
import { resolveWidgetLiveDataPatch } from "../data-source/live-data-service.js";
import { listSpacePdfExports } from "../services/exports/list-space-pdf-exports.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeImageDownloadName(raw: string | undefined, fallback: string, fileExt: string): string {
  const base = (raw ?? fallback).trim().replace(/\.(png|jpe?g|webp)$/i, "");
  const safe = base.replace(/[^a-zA-Z0-9._\-]+/g, "_").slice(0, 120) || "image";
  return `${safe}.${fileExt}`;
}

async function readImageExportBuffer(
  spaceId: string,
  exportId: string,
  userId: string,
): Promise<{ buf: Buffer; contentType: string; fileExt: string } | null> {
  const tries: [ReturnType<typeof spaceExportRasterPath>, string, string][] = [
    [spaceExportRasterPath(spaceId, exportId, "png", userId), "image/png", "png"],
    [spaceExportRasterPath(spaceId, exportId, "webp", userId), "image/webp", "webp"],
    [spaceExportRasterPath(spaceId, exportId, "jpeg", userId), "image/jpeg", "jpeg"],
  ];
  for (const [p, ct, ext] of tries) {
    try {
      const buf = await fs.readFile(p);
      return { buf, contentType: ct, fileExt: ext };
    } catch {
      /* try next */
    }
  }
  const jpgPath = path.join(spaceExportsDir(spaceId, userId), `${exportId}.jpg`);
  try {
    const buf = await fs.readFile(jpgPath);
    return { buf, contentType: "image/jpeg", fileExt: "jpg" };
  } catch {
    return null;
  }
}

export async function registerWidgetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces/:spaceId/exports", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if (!UUID_RE.test(spaceId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const exports = await listSpacePdfExports(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ exports }));
  });

  app.get("/api/spaces/:spaceId/exports/pdf/:exportId", async (req, reply) => {
    const { spaceId, exportId } = req.params as { spaceId: string; exportId: string };
    if (!UUID_RE.test(spaceId) || !UUID_RE.test(exportId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space or export id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const q = req.query as { filename?: string };
    const attachmentName = sanitizePdfFilename(
      typeof q.filename === "string" ? q.filename : undefined,
      "export",
    );

    const filePath = spaceExportPdfPath(spaceId, exportId, DEFAULT_USER_ID);
    let buf: Buffer;
    try {
      buf = await fs.readFile(filePath);
    } catch {
      return reply.code(404).send(apiErr("not_found", "PDF export not found"));
    }

    const safeName = attachmentName.replace(/"/g, "");
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${safeName}"`);
    return reply.send(buf);
  });

  app.get("/api/spaces/:spaceId/exports/image/:exportId", async (req, reply) => {
    const { spaceId, exportId } = req.params as { spaceId: string; exportId: string };
    if (!UUID_RE.test(spaceId) || !UUID_RE.test(exportId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space or export id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const read = await readImageExportBuffer(spaceId, exportId, DEFAULT_USER_ID);
    if (!read) return reply.code(404).send(apiErr("not_found", "Image export not found"));

    const q = req.query as { filename?: string };
    const attachmentName = sanitizeImageDownloadName(
      typeof q.filename === "string" ? q.filename : undefined,
      "generated",
      read.fileExt,
    );
    const safeName = attachmentName.replace(/"/g, "");
    reply.header("Content-Type", read.contentType);
    reply.header("Content-Disposition", `attachment; filename="${safeName}"`);
    return reply.send(read.buf);
  });

  app.get("/api/spaces/:spaceId/widgets", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const { valid: widgets, warnings: loadWarnings } = await store.listWidgetRecordsDetailed(
      spaceId,
      DEFAULT_USER_ID,
    );
    return reply.send(apiOk({ widgets, loadWarnings }));
  });

  app.post("/api/spaces/:spaceId/widgets", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const created = await createWidgetForSpace(spaceId, req.body, DEFAULT_USER_ID);
    if (!created.ok) {
      return reply.code(400).send(apiErr(created.code, created.message));
    }
    return reply.send(apiOk({ widget: created.widget }));
  });

  app.get("/api/spaces/:spaceId/widgets/:widgetId/live-data", async (req, reply) => {
    const { spaceId, widgetId } = req.params as { spaceId: string; widgetId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const w = await store.getWidget(spaceId, widgetId, DEFAULT_USER_ID);
    if (!w) return reply.code(404).send(apiErr("not_found", "Widget not found"));
    const r = resolveWidgetLiveDataPatch(w);
    return reply.send(
      apiOk({
        dataPatch: r.dataPatch,
        asOf: new Date().toISOString(),
        sourceKey: r.sourceKey,
        warning: r.warning,
      }),
    );
  });

  app.patch("/api/spaces/:spaceId/widgets/:widgetId", async (req, reply) => {
    const { spaceId, widgetId } = req.params as { spaceId: string; widgetId: string };
    const updated = await updateWidgetForSpace(spaceId, widgetId, req.body, DEFAULT_USER_ID);
    if (!updated.ok) {
      const code = updated.code === "not_found" ? 404 : 400;
      return reply.code(code).send(apiErr(updated.code, updated.message));
    }
    return reply.send(apiOk({ widget: updated.widget }));
  });

  app.delete("/api/spaces/:spaceId/widgets/:widgetId", async (req, reply) => {
    const { spaceId, widgetId } = req.params as { spaceId: string; widgetId: string };
    const ok = await deleteWidgetForSpace(spaceId, widgetId, DEFAULT_USER_ID);
    if (!ok) return reply.code(404).send(apiErr("not_found", "Widget not found"));
    return reply.send(apiOk({ deleted: true as const }));
  });
}
