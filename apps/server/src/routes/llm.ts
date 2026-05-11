import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ChatMessage } from "@airis/shared";
import * as store from "../persistence/space-store.js";
import { respond } from "../llm/respond.js";
import { DEFAULT_USER_ID } from "../config.js";

const RespondBody = z.object({
  spaceId: z.string().uuid(),
  content: z.string().min(1),
  modelId: z.string().optional(),
});

export async function registerLlmRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/llm/respond", async (req, reply) => {
    const body = RespondBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const bundle = await store.loadSpaceBundle(body.data.spaceId, DEFAULT_USER_ID);
    if (!bundle) return reply.code(404).send({ error: "not_found" });
    const history: ChatMessage[] = bundle.chat;
    try {
      const r = await respond(history, body.data.content, {
        spaceId: body.data.spaceId,
        modelId: body.data.modelId,
      });
      return { text: r.text, activeSkillIds: r.activeSkillIds, skillPromptMetrics: r.skillPromptMetrics };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send({ error: "llm_failed", detail: msg });
    }
  });
}
