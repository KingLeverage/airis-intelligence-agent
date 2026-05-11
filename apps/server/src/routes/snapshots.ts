import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as store from "../persistence/space-store.js";
import {
  createSnapshot,
  getSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "../snapshots/service.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import * as spaceStore from "../persistence/space-store.js";

const PostSnapshotBody = z.object({
  label: z.string().optional(),
  reason: z.string().optional(),
});

export async function registerSnapshotRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces/:spaceId/snapshots", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const snapshots = await listSnapshots(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ snapshots }));
  });

  app.post("/api/spaces/:spaceId/snapshots", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const body = PostSnapshotBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const label = body.data.reason ?? body.data.label ?? "manual snapshot";
    const snap = await createSnapshot(spaceId, "manual", {
      label,
      userId: DEFAULT_USER_ID,
      force: true,
    });
    if (!snap) return reply.code(500).send(apiErr("snapshot_failed", "Could not create snapshot"));
    return reply.send(apiOk({ snapshot: snap.meta, bundle: snap }));
  });

  app.post("/api/spaces/:spaceId/restore/:snapshotId", async (req, reply) => {
    const { spaceId, snapshotId } = req.params as { spaceId: string; snapshotId: string };
    const r = await restoreSnapshot(spaceId, snapshotId, DEFAULT_USER_ID);
    if (!r.ok) return reply.code(400).send(apiErr("restore_failed", r.error));
    const widgets = await spaceStore.listWidgetRecords(spaceId, DEFAULT_USER_ID);
    return reply.send(
      apiOk({
        restored: true as const,
        widgetCount: r.widgetCount,
        preRestoreSnapshotId: r.preRestoreSnapshotId,
        widgets,
      }),
    );
  });

  app.get("/api/spaces/:spaceId/snapshots/:snapshotId", async (req, reply) => {
    const { spaceId, snapshotId } = req.params as { spaceId: string; snapshotId: string };
    const bundle = await getSnapshot(spaceId, snapshotId, DEFAULT_USER_ID);
    if (!bundle) return reply.code(404).send(apiErr("not_found", "Snapshot not found or invalid"));
    return reply.send(apiOk({ bundle }));
  });
}
