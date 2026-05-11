import { z } from "zod";

/** Estimated prompt footprint from skill sections for one chat turn (not tokenizer-accurate). */
export const SkillPromptMetricsSchema = z.object({
  discoveryChars: z.number().int().nonnegative(),
  activationChars: z.number().int().nonnegative(),
  templateHintsChars: z.number().int().nonnegative(),
  /** discovery + activation + template hints (subset of system prompt). */
  skillsSectionTotalChars: z.number().int().nonnegative(),
  activeSkillIds: z.array(z.string()),
  /** Injected instruction body length per routed skill after truncation. */
  perSkillInstructionChars: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export type SkillPromptMetrics = z.infer<typeof SkillPromptMetricsSchema>;

/** Aggregated per-space skill usage (persisted under space dir). */
export const SpaceSkillAnalyticsSchema = z.object({
  schemaVersion: z.literal(1),
  spaceId: z.string().uuid(),
  updatedAt: z.string().datetime(),
  /** Chat turns that recorded skill prompt metrics. */
  turnsRecorded: z.number().int().nonnegative(),
  /** Running sum of skillsSectionTotalChars across turns. */
  totalEstimatedSkillPromptChars: z.number().int().nonnegative(),
  bySkillId: z.record(
    z.string(),
    z.object({
      routedCount: z.number().int().nonnegative(),
      lastRoutedAt: z.string().datetime().optional(),
      instructionCharsInjected: z.number().int().nonnegative(),
    }),
  ),
});

export type SpaceSkillAnalytics = z.infer<typeof SpaceSkillAnalyticsSchema>;
