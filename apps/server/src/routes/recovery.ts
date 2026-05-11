import type { FastifyInstance } from "fastify";
import {
  disableWidgetForRecovery,
  inspectAllSpaces,
  inspectSpace,
  repairSpaceBasics,
  validateSnapshotForRestore,
} from "../recovery/service.js";
import { restoreSnapshot } from "../snapshots/service.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";

export async function registerRecoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/recovery/spaces", async (_req, reply) => {
    try {
      const spaces = await inspectAllSpaces(DEFAULT_USER_ID);
      return reply.send(apiOk({ spaces }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send(apiErr("recovery_failed", msg));
    }
  });

  app.get("/api/recovery/spaces/:spaceId", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    try {
      const detail = await inspectSpace(spaceId, DEFAULT_USER_ID);
      return reply.send(apiOk(detail));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send(apiErr("recovery_failed", msg));
    }
  });

  app.post("/api/recovery/spaces/:spaceId/repair", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    try {
      const result = await repairSpaceBasics(spaceId, DEFAULT_USER_ID);
      return reply.send(apiOk(result));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send(apiErr("repair_failed", msg));
    }
  });

  app.post("/api/recovery/spaces/:spaceId/widgets/:widgetId/disable", async (req, reply) => {
    const { spaceId, widgetId } = req.params as { spaceId: string; widgetId: string };
    const r = await disableWidgetForRecovery(spaceId, widgetId, DEFAULT_USER_ID);
    if (!r.ok) return reply.code(400).send(apiErr("disable_failed", r.error));
    return reply.send(apiOk({ disabled: true as const }));
  });

  app.post("/api/recovery/spaces/:spaceId/restore/:snapshotId", async (req, reply) => {
    const { spaceId, snapshotId } = req.params as { spaceId: string; snapshotId: string };
    const v = await validateSnapshotForRestore(spaceId, snapshotId, DEFAULT_USER_ID);
    if (!v.ok) return reply.code(400).send(apiErr("invalid_snapshot", v.error));
    const r = await restoreSnapshot(spaceId, snapshotId, DEFAULT_USER_ID);
    if (!r.ok) return reply.code(400).send(apiErr("restore_failed", r.error));
    return reply.send(
      apiOk({
        restored: true as const,
        widgetCount: r.widgetCount,
        preRestoreSnapshotId: r.preRestoreSnapshotId,
      }),
    );
  });

  /** @deprecated Use GET /api/recovery/spaces */
  app.get("/api/recovery/summary", async (_req, reply) => {
    try {
      const spaces = await inspectAllSpaces(DEFAULT_USER_ID);
      return reply.send(
        apiOk({
          spaces: spaces.map((s) => ({
            id: s.spaceId,
            name: s.name,
            brokenWidgets: s.issues
              .filter((i) => i.entityType === "widget")
              .map((i) => ({ id: i.entityId ?? "", file: i.entityId ?? "", error: i.message })),
            snapshotCount: s.snapshotCount,
            loadError: s.loadError,
          })),
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send(apiErr("recovery_failed", msg));
    }
  });
}
