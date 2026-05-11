import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SkillSummary } from "@airis/shared";
import { apiErr, apiOk } from "../utils/api-response.js";
import { DEFAULT_USER_ID } from "../config.js";
import * as spaceStore from "../services/spaces/SpaceService.js";
import {
  listSkillManifests,
  listSkillSummaries,
  loadSkillManifest,
  loadSkillInstructions,
  manifestToSummary,
} from "../skills/skill-discovery.js";
import {
  getSpaceSkillConfig,
  updateSpaceSkillConfig,
  enableSkill,
  disableSkill,
} from "../skills/space-skill-service.js";
import {
  listDraftSkills,
  inspectDraftFolder,
  createDraftSkill,
  promoteDraftSkill,
  deleteDraftSkill,
} from "../skills/draft-skill-service.js";
import { getSpaceSkillAnalytics } from "../skills/skill-analytics-service.js";

const SpaceIdParams = z.object({ spaceId: z.string().uuid() });
const SkillIdParams = z.object({ skillId: z.string().min(1) });
const DraftIdParams = z.object({ draftId: z.string().min(1) });

const PutSpaceSkillsBody = z.object({
  enabledSkillIds: z.array(z.string()).optional(),
  pinnedSkillIds: z.array(z.string()).optional(),
});

const CreateDraftBody = z.object({
  draftId: z.string().min(1),
  manifest: z.record(z.unknown()),
  skillMd: z.string().optional(),
});

export async function registerSkillRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/skills/drafts", async (_req, reply) => {
    const drafts = await listDraftSkills();
    return reply.send(apiOk({ drafts }));
  });

  app.post("/api/skills/drafts", async (req, reply) => {
    const body = CreateDraftBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const created = await createDraftSkill(body.data);
    if (!created.valid) {
      return reply
        .code(400)
        .send(apiErr("draft_invalid", created.errors.join("; ") || "invalid_draft"));
    }
    return reply.send(apiOk({ draft: created }));
  });

  app.get("/api/skills/drafts/:draftId", async (req, reply) => {
    const p = DraftIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const draft = await inspectDraftFolder(p.data.draftId);
    return reply.send(apiOk({ draft }));
  });

  app.post("/api/skills/drafts/:draftId/validate", async (req, reply) => {
    const p = DraftIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const draft = await inspectDraftFolder(p.data.draftId);
    return reply.send(apiOk({ draft }));
  });

  app.post("/api/skills/drafts/:draftId/promote", async (req, reply) => {
    const p = DraftIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const result = await promoteDraftSkill(p.data.draftId);
    if (!result.ok) return reply.code(400).send(apiErr("promote_failed", result.error));
    return reply.send(apiOk({ skillId: result.skillId }));
  });

  app.delete("/api/skills/drafts/:draftId", async (req, reply) => {
    const p = DraftIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const result = await deleteDraftSkill(p.data.draftId);
    if (!result.ok) return reply.code(400).send(apiErr("delete_failed", result.error));
    return reply.send(apiOk({ deleted: true as const }));
  });

  app.get("/api/skills", async (_req, reply) => {
    const skills = await listSkillSummaries();
    return reply.send(apiOk({ skills }));
  });

  app.get("/api/skills/:skillId", async (req, reply) => {
    const p = SkillIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const manifest = await loadSkillManifest(p.data.skillId);
    if (!manifest) return reply.code(404).send(apiErr("not_found", "Skill not found"));
    const q = z.object({ full: z.enum(["1"]).optional() }).safeParse(req.query);
    let instructionsPreview: string | undefined;
    let instructionsWarning: string | undefined;
    if (q.success && q.data.full === "1") {
      const loaded = await loadSkillInstructions(p.data.skillId);
      instructionsPreview = loaded.body ?? undefined;
      instructionsWarning = loaded.warning;
    } else {
      const loaded = await loadSkillInstructions(p.data.skillId);
      if (loaded.body) {
        instructionsPreview = `${loaded.body.slice(0, 2500)}${loaded.body.length > 2500 ? "…" : ""}`;
      }
      instructionsWarning = loaded.warning;
    }
    return reply.send(apiOk({ manifest, instructionsPreview, instructionsWarning }));
  });

  app.get("/api/spaces/:spaceId/skills/analytics", async (req, reply) => {
    const p = SpaceIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const meta = await spaceStore.getSpaceMeta(p.data.spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const analytics = await getSpaceSkillAnalytics(p.data.spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ analytics }));
  });

  app.get("/api/spaces/:spaceId/skills", async (req, reply) => {
    const p = SpaceIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const meta = await spaceStore.getSpaceMeta(p.data.spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const config = await getSpaceSkillConfig(p.data.spaceId, DEFAULT_USER_ID);
    const manifests = await listSkillManifests();
    const enabled = new Set(config.enabledSkillIds);
    const pinned = new Set(config.pinnedSkillIds ?? []);
    const skills: SkillSummary[] = manifests.map((m) => ({
      ...manifestToSummary(m),
      enabled: enabled.has(m.id),
      pinned: pinned.has(m.id),
    }));
    return reply.send(apiOk({ config, skills }));
  });

  app.put("/api/spaces/:spaceId/skills", async (req, reply) => {
    const p = SpaceIdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send(apiErr("invalid_params", p.error.message));
    const meta = await spaceStore.getSpaceMeta(p.data.spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const body = PutSpaceSkillsBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    if (body.data.enabledSkillIds == null && body.data.pinnedSkillIds == null) {
      return reply.code(400).send(apiErr("invalid_body", "enabledSkillIds_or_pinnedSkillIds_required"));
    }
    const config = await updateSpaceSkillConfig(p.data.spaceId, body.data, DEFAULT_USER_ID);
    return reply.send(apiOk({ config }));
  });

  app.post("/api/spaces/:spaceId/skills/:skillId/enable", async (req, reply) => {
    const spaceId = (req.params as { spaceId: string }).spaceId;
    const skillId = (req.params as { skillId: string }).skillId;
    if (!z.string().uuid().safeParse(spaceId).success) {
      return reply.code(400).send(apiErr("invalid_params", "spaceId"));
    }
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const config = await enableSkill(spaceId, skillId, DEFAULT_USER_ID);
    return reply.send(apiOk({ config }));
  });

  app.post("/api/spaces/:spaceId/skills/:skillId/disable", async (req, reply) => {
    const spaceId = (req.params as { spaceId: string }).spaceId;
    const skillId = (req.params as { skillId: string }).skillId;
    if (!z.string().uuid().safeParse(spaceId).success) {
      return reply.code(400).send(apiErr("invalid_params", "spaceId"));
    }
    const meta = await spaceStore.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    const config = await disableSkill(spaceId, skillId, DEFAULT_USER_ID);
    return reply.send(apiOk({ config }));
  });
}
