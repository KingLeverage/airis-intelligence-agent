import type { FastifyInstance, FastifyReply } from "fastify";
import { AgentStreamRequestSchema } from "@airis/shared";
import { Readable } from "node:stream";
import { getDefaultModelId, DEFAULT_USER_ID } from "../config.js";
import { resolveLlmRuntime } from "../llm/resolve-llm-runtime.js";
import { runEmbeddedAgentStream } from "../agents/orchestrator.js";

function ndjsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

export async function registerAgentStreamRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/agent/stream", async (req, reply: FastifyReply) => {
    const parsed = AgentStreamRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const spawnErr = flat.fieldErrors.spawnDepth?.length;
      if (spawnErr) {
        return reply.code(400).send({
          error: "spawn_depth_exceeded",
          message: "spawnDepth must be at most 2",
          issues: flat,
        });
      }
      return reply.code(400).send({
        error: "invalid_body",
        message: "Request does not match AgentStreamRequestSchema",
        issues: flat,
      });
    }

    const body = parsed.data;

    const modelId = getDefaultModelId();
    const runtime = await resolveLlmRuntime(DEFAULT_USER_ID, modelId);

    reply.header("Content-Type", "application/x-ndjson; charset=utf-8");
    reply.header("Cache-Control", "no-cache");

    const stream = Readable.from(
      (async function* () {
        try {
          for await (const text of runEmbeddedAgentStream({
            request: body,
            runtime,
            modelId,
          })) {
            yield ndjsonLine({ type: "delta", text });
          }
          yield ndjsonLine({ type: "done" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          yield ndjsonLine({ type: "error", detail: msg });
        }
      })(),
    );

    return reply.send(stream);
  });
}
