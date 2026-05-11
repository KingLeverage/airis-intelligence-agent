import type { FastifyInstance } from "fastify";
import { LayoutStateSchema } from "@airis/shared";
import * as store from "../persistence/space-store.js";
import { snapshotAfterMutation } from "../snapshots/hooks.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";

export async function registerLayoutRoutes(app: FastifyInstance): Promise<void> {
  app.patch("/api/spaces/:spaceId/layout", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const p = LayoutStateSchema.safeParse(req.body);
    if (!p.success) {
      return reply.code(400).send(apiErr("invalid_layout", p.error.message));
    }
    await store.writeLayout(spaceId, p.data, DEFAULT_USER_ID);
    await snapshotAfterMutation(spaceId, DEFAULT_USER_ID, "layout.update", ["layout"]);
    return reply.send(apiOk({ layout: p.data }));
  });
}
