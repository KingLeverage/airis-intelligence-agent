import { z } from "zod";
import { ExecutionTypeSchema } from "../protocol/execution.js";
import { WidgetKindSchema } from "./widget.js";

/** Declarative skill manifest (skill.json). No executable code. */
export const SkillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  version: z.string().default("0.1.0"),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  triggers: z.array(z.string()).default([]),
  /** Must name real execution types from the workspace protocol. */
  allowedExecutionTypes: z.array(ExecutionTypeSchema).default([]),
  /** Must name registered widget kinds. */
  recommendedWidgets: z.array(WidgetKindSchema).default([]),
  promptHint: z.string().optional(),
  entryInstructionFile: z.string().default("SKILL.md"),
  templatesPath: z.string().optional(),
  /** When true (default), new spaces inherit this skill unless space config overrides. */
  enabledByDefault: z.boolean().default(true),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

/** Lightweight listing / API row; `enabled` / `pinned` are per-space. */
export const SkillSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  version: z.string(),
  promptHint: z.string().optional(),
  enabled: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export type SkillSummary = z.infer<typeof SkillSummarySchema>;

export const SpaceSkillConfigSchema = z.object({
  spaceId: z.string().uuid(),
  enabledSkillIds: z.array(z.string()),
  pinnedSkillIds: z.array(z.string()).default([]),
  updatedAt: z.string().datetime(),
});

export type SpaceSkillConfig = z.infer<typeof SpaceSkillConfigSchema>;

/** In-memory / prompt assembly context for one chat turn. */
export const ActiveSkillContextSchema = z.object({
  activeSkillIds: z.array(z.string()),
  activeSkills: z.array(SkillManifestSchema),
  loadedInstructionBodies: z.record(z.string()),
  routingReasons: z.array(z.string()),
});

export type ActiveSkillContext = z.infer<typeof ActiveSkillContextSchema>;
