import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as store from "../persistence/space-store.js";
import {
  seedDemoSpacesIfMissing,
  syncDemoSpaceMetadataFromTemplates,
} from "../persistence/seed-demo-spaces.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const CreateSpaceBody = z.object({ name: z.string().min(1) });

const PutSpacePreviewBody = z.object({
  imageBase64: z.string().min(24),
});

export async function registerSpaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces", async (req, reply) => {
    try {
      await store.initGlobalFiles(DEFAULT_USER_ID);
      await seedDemoSpacesIfMissing(DEFAULT_USER_ID);
      await syncDemoSpaceMetadataFromTemplates(DEFAULT_USER_ID);
      const spaces = await store.listSpacesMeta(DEFAULT_USER_ID);
      return reply.send(apiOk({ spaces }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.log.error({ err }, "GET /api/spaces failed");
      return reply.code(500).send(apiErr("internal_error", msg));
    }
  });

  app.post("/api/spaces", async (req, reply) => {
    const p = CreateSpaceBody.safeParse(req.body);
    if (!p.success) {
      return reply.code(400).send(apiErr("invalid_body", p.error.message));
    }
    const space = await store.createSpace(p.data.name, DEFAULT_USER_ID);
    return reply.send(apiOk({ space }));
  });

  app.get("/api/spaces/:spaceId/preview", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if ((await store.getSpaceMeta(spaceId, DEFAULT_USER_ID)) == null) {
      return reply.code(404).send(apiErr("not_found", "Space not found"));
    }
    const buf = await store.readSpacePreviewJpeg(spaceId, DEFAULT_USER_ID);
    if (!buf) return reply.code(404).send(apiErr("not_found", "No preview"));
    reply.header("Cache-Control", "private, max-age=120");
    return reply.type("image/jpeg").send(buf);
  });

  app.put("/api/spaces/:spaceId/preview", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const p = PutSpacePreviewBody.safeParse(req.body);
    if (!p.success) {
      return reply.code(400).send(apiErr("invalid_body", p.error.message));
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(p.data.imageBase64, "base64");
    } catch {
      return reply.code(400).send(apiErr("invalid_body", "Invalid base64"));
    }
    const meta = await store.saveSpacePreviewJpeg(spaceId, buf, DEFAULT_USER_ID);
    if (!meta) {
      return reply.code(400).send(apiErr("invalid_preview", "Space not found or image rejected"));
    }
    return reply.send(apiOk({ space: meta }));
  });

  app.get("/api/spaces/:spaceId", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const bundle = await store.loadSpaceBundle(spaceId, DEFAULT_USER_ID);
    if (!bundle) return reply.code(404).send(apiErr("not_found", "Space not found"));
    return reply.send(apiOk(bundle));
  });

  app.delete("/api/spaces/:spaceId", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if ((await store.getSpaceMeta(spaceId, DEFAULT_USER_ID)) == null) {
      return reply.code(404).send(apiErr("not_found", "Space not found"));
    }
    await store.deleteSpace(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ deleted: true as const }));
  });

  app.post("/api/spaces/:spaceId/clone", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.cloneSpace(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    return reply.send(apiOk({ space: meta }));
  });
}
