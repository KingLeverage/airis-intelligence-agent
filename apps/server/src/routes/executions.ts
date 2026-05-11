import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import * as store from "../persistence/space-store.js";
import { executionsDir } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import { coerceExecutionRecord } from "../execution/coerce-record.js";

export async function registerExecutionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces/:spaceId/executions", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const dir = executionsDir(spaceId, DEFAULT_USER_ID);
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    } catch {
      files = [];
    }
    files.sort().reverse();
    const records = [];
    for (const f of files.slice(0, 50)) {
      const text = await fs.readFile(path.join(dir, f), "utf8");
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        console.warn(`[executions] corrupt JSON skipped: ${spaceId}/${f}`);
        continue;
      }
      const rec = coerceExecutionRecord(raw);
      if (rec) records.push(rec);
      else console.warn(`[executions] unparseable record skipped: ${spaceId}/${f}`);
    }
    return reply.send(apiOk({ executions: records }));
  });
}
