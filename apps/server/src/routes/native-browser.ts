import type { FastifyInstance } from "fastify";
import {
  applyStalePolicy,
  drainPending,
  registerNativeBridge,
  resolveNativeResult,
} from "../browser/native-bridge.js";

export async function registerNativeBrowserRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/native-browser/register", async (_req, reply) => {
    registerNativeBridge();
    return reply.send({ ok: true });
  });

  app.get("/api/native-browser/pending", async (_req, reply) => {
    applyStalePolicy();
    registerNativeBridge();
    return reply.send({ pending: drainPending() });
  });

  app.post("/api/native-browser/result/:requestId", async (req, reply) => {
    const { requestId } = req.params as { requestId: string };
    const body = req.body as { result?: unknown } | undefined;
    resolveNativeResult(requestId, body?.result);
    return reply.send({ ok: true });
  });
}
