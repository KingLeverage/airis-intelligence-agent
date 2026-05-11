import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_USER_ID } from "../config.js";
import {
  maskProfileLlm,
  mergeProfileLlm,
  readProfileLlm,
} from "../persistence/profile-llm-store.js";
import { fetchOpenRouterModelsList } from "../llm/openai-compatible-chat.js";
import { normalizeOpenRouterProviderBase } from "../llm/openrouter-profile-utils.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const PutBodySchema = z.object({
  clearOpenrouter: z.boolean().optional(),
  openrouter: z
    .object({
      apiKey: z.string().optional(),
      defaultModel: z.string().nullable().optional(),
      siteUrl: z.string().nullable().optional(),
      appName: z.string().nullable().optional(),
      providerBaseUrl: z.string().nullable().optional(),
      maxTokens: z.number().int().positive().max(2_000_000).nullable().optional(),
      promptBudgetSystemPct: z.number().min(0).max(100).nullable().optional(),
      promptBudgetHistoryPct: z.number().min(0).max(100).nullable().optional(),
      promptBudgetTransientPct: z.number().min(0).max(100).nullable().optional(),
      singleHistoryMessagePct: z.number().min(0).max(100).nullable().optional(),
      paramsText: z.string().nullable().optional(),
    })
    .optional(),
  clearOpenai: z.boolean().optional(),
  openai: z
    .object({
      apiKey: z.string().optional(),
      defaultModel: z.string().nullable().optional(),
      baseUrl: z.string().nullable().optional(),
    })
    .optional(),
  clearAnthropic: z.boolean().optional(),
  anthropic: z
    .object({
      apiKey: z.string().optional(),
      defaultModel: z.string().nullable().optional(),
    })
    .optional(),
});

export async function registerProfileLlmRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/profile/llm", async (_req, reply) => {
    const raw = await readProfileLlm(DEFAULT_USER_ID);
    return reply.send(apiOk(maskProfileLlm(raw)));
  });

  app.put("/api/profile/llm", async (req, reply) => {
    const body = PutBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send(apiErr("invalid_body", body.error.message));
    }
    const merged = await mergeProfileLlm(DEFAULT_USER_ID, body.data);
    return reply.send(apiOk(maskProfileLlm(merged)));
  });

  const ValidateBody = z.object({
    /** When omitted, uses the key already saved in profile. */
    apiKey: z.string().min(1).optional(),
    /** When set, used instead of the saved profile base URL (try before save). */
    providerBaseUrl: z.string().optional(),
  });

  app.post("/api/profile/llm/openrouter/validate", async (req, reply) => {
    const body = ValidateBody.safeParse(req.body ?? {});
    if (!body.success) {
      return reply.code(400).send(apiErr("invalid_body", body.error.message));
    }
    const profile = await readProfileLlm(DEFAULT_USER_ID);
    const apiKey = body.data.apiKey?.trim() || profile.openrouter?.apiKey;
    if (!apiKey) {
      return reply
        .code(400)
        .send(apiErr("no_key", "Provide apiKey in the body for a one-off check, or save a key in profile first."));
    }
    const baseUrl = normalizeOpenRouterProviderBase(
      body.data.providerBaseUrl?.trim() || profile.openrouter?.providerBaseUrl,
    );
    const r = await fetchOpenRouterModelsList({ apiKey, baseUrl });
    if (!r.ok) {
      return reply.code(502).send(
        apiErr("openrouter_validate_failed", `HTTP ${r.status}: ${r.message.slice(0, 200)}`),
      );
    }
    return reply.send(apiOk({ ok: true as const, modelCount: r.count }));
  });
}
