import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { PassThrough } from "node:stream";
import { v4 as uuid } from "uuid";
import type { ChatMessage, SkillPromptMetrics } from "@airis/shared";
import * as spaceStore from "../services/spaces/SpaceService.js";
import {
  respond,
  streamLlmResponse,
  finalizeAssistantResponse,
  getBrowserSessionSnapshot,
} from "../services/chat/ChatService.js";
import { composeSystemPromptWithSkills } from "../skills/chat-skill-prompt.js";
import { buildBrowserPromptContext } from "@airis/shared";
import * as browserSession from "../browser/session-store.js";
import { createDefaultSession } from "../browser/session-store.js";
import { DEFAULT_USER_ID, getDefaultModelId } from "../config.js";
import { resolveLlmRuntime } from "../llm/resolve-llm-runtime.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import * as store from "../persistence/space-store.js";
import { recordSkillAnalytics } from "../skills/skill-analytics-service.js";

const PostChatBody = z
  .object({
    message: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    modelId: z.string().optional(),
  })
  .refine((b) => Boolean(b.message?.trim() || b.content?.trim()), {
    message: "message_or_content_required",
  });

function ndjsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

function userText(body: z.infer<typeof PostChatBody>): string {
  return (body.message ?? body.content ?? "").trim();
}

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces/:spaceId/chat", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const messages = await spaceStore.readChat(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ messages }));
  });

  app.delete("/api/spaces/:spaceId/chat", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    await store.clearChat(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ cleared: true }));
  });

  app.post("/api/spaces/:spaceId/chat", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const body = PostChatBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send(apiErr("invalid_body", body.error.message));
    }

    const text = userText(body.data);
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: uuid(),
      spaceId,
      role: "user",
      content: text,
      createdAt: now,
    };
    await spaceStore.appendChatMessage(userMsg, spaceId, DEFAULT_USER_ID);

    const history = await spaceStore.readChat(spaceId, DEFAULT_USER_ID);
    const t0 = Date.now();
    let assistantRaw: string;
    let activeSkillIds: string[] = [];
    let skillRoutingReasons: string[] = [];
    let skillPromptMetrics: SkillPromptMetrics;
    try {
      const r = await respond(history, text, {
        spaceId,
        modelId: body.data.modelId,
      });
      assistantRaw = r.text;
      activeSkillIds = r.activeSkillIds;
      skillRoutingReasons = r.routingReasons;
      skillPromptMetrics = r.skillPromptMetrics;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send(apiErr("llm_failed", msg));
    }

    const finalized = await finalizeAssistantResponse(spaceId, assistantRaw, DEFAULT_USER_ID, t0, {
      activeSkillIds,
      skillPromptMetrics,
      modelId: body.data.modelId,
      log: req.log,
    });
    try {
      await recordSkillAnalytics(spaceId, skillPromptMetrics, DEFAULT_USER_ID);
    } catch (err) {
      req.log.warn({ err }, "skill_analytics_write_failed");
    }
    const spaceGone = finalized.spaceDeletedAfterTurn === true;
    const widgets = spaceGone ? [] : await store.listWidgetRecords(spaceId, DEFAULT_USER_ID);
    const browserSession = spaceGone
      ? createDefaultSession(spaceId)
      : await getBrowserSessionSnapshot(spaceId, DEFAULT_USER_ID);

    return reply.send(
      apiOk({
        userMessage: userMsg,
        assistantMessage: finalized.assistantMsg,
        execution: finalized.execRecord,
        results: finalized.results,
        widgets,
        browserSession,
        result: finalized.executionResult,
        spaceDeletedAfterTurn: finalized.spaceDeletedAfterTurn,
        activeSkillIds,
        skillRoutingReasons,
        skillPromptMetrics,
      }),
    );
  });

  app.post("/api/spaces/:spaceId/chat/stream", async (req, reply: FastifyReply) => {
    const { spaceId } = req.params as { spaceId: string };
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send({ error: "not_found" });

    const body = PostChatBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const text = userText(body.data);
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: uuid(),
      spaceId,
      role: "user",
      content: text,
      createdAt: now,
    };
    await spaceStore.appendChatMessage(userMsg, spaceId, DEFAULT_USER_ID);

    const history = await spaceStore.readChat(spaceId, DEFAULT_USER_ID);
    const bundle = await spaceStore.loadSpaceBundle(spaceId, DEFAULT_USER_ID);
    if (!bundle) return reply.code(404).send({ error: "not_found" });

    const bs = await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const browser = bs.lastTranscription ?? null;
    const {
      system,
      activeSkillIds,
      routingReasons: skillRoutingReasons,
      skillPromptMetrics,
    } = await composeSystemPromptWithSkills(bundle, {
      spaceId,
      userId: DEFAULT_USER_ID,
      userMessage: text,
      browserTranscription: browser,
      browserPromptContext: buildBrowserPromptContext(bs),
      browserSession: bs,
    });

    const t0 = Date.now();
    const pt = new PassThrough();
    reply.header("Content-Type", "application/x-ndjson; charset=utf-8");
    reply.header("Cache-Control", "no-cache");
    reply.send(pt);

    const streamModelId = body.data.modelId ?? getDefaultModelId();
    const runtime = await resolveLlmRuntime(DEFAULT_USER_ID, streamModelId);

    void (async () => {
      let assistantRaw = "";
      try {
        for await (const chunk of streamLlmResponse({
          history,
          userMessage: text,
          modelId: streamModelId,
          system,
          runtime,
        })) {
          assistantRaw += chunk;
          pt.write(ndjsonLine({ type: "delta", text: chunk }));
        }
        const finalized = await finalizeAssistantResponse(spaceId, assistantRaw, DEFAULT_USER_ID, t0, {
          activeSkillIds,
          skillPromptMetrics,
          modelId: streamModelId,
          log: req.log,
        });
        try {
          await recordSkillAnalytics(spaceId, skillPromptMetrics, DEFAULT_USER_ID);
        } catch (err) {
          req.log.warn({ err }, "skill_analytics_write_failed");
        }
        const spaceGone = finalized.spaceDeletedAfterTurn === true;
        const widgets = spaceGone ? [] : await store.listWidgetRecords(spaceId, DEFAULT_USER_ID);
        const browserSessionSnap = spaceGone
          ? createDefaultSession(spaceId)
          : await getBrowserSessionSnapshot(spaceId, DEFAULT_USER_ID);
        pt.write(
          ndjsonLine({
            type: "done",
            message: finalized.assistantMsg,
            execution: finalized.execRecord,
            results: finalized.results,
            widgets,
            browserSession: browserSessionSnap,
            result: finalized.executionResult,
            spaceDeletedAfterTurn: finalized.spaceDeletedAfterTurn,
            activeSkillIds,
            skillRoutingReasons,
            skillPromptMetrics,
          }),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pt.write(ndjsonLine({ type: "error", detail: msg }));
      } finally {
        pt.end();
      }
    })();
  });
}
