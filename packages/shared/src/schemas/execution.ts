import { z } from "zod";
import { ParsedExecutionBlockSchema } from "../protocol/execution.js";
import { SkillPromptMetricsSchema } from "./skill-analytics.js";

/** @deprecated Legacy log shape; used only to read old files under executions/ */
export const ExecutionBlockResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  detail: z.string().optional(),
});

export const ExecutionParsedBlockSchema = z.union([
  ParsedExecutionBlockSchema,
  z.object({ parseError: z.string() }),
]);

export type ExecutionParsedBlock = z.infer<typeof ExecutionParsedBlockSchema>;

export const LegacyExecutionRecordSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  createdAt: z.string().datetime(),
  rawAssistantExcerpt: z.string().optional(),
  parsedBlocks: z.array(z.union([ExecutionParsedBlockSchema, z.record(z.unknown())])),
  results: z.array(ExecutionBlockResultSchema),
  durationMs: z.number().optional(),
});

export type LegacyExecutionRecord = z.infer<typeof LegacyExecutionRecordSchema>;

/** Current execution log entry (one per chat turn that runs the pipeline). */
export const ExecutionRecordStatusSchema = z.enum(["parsed", "applied", "rejected", "failed"]);

export type ExecutionRecordStatus = z.infer<typeof ExecutionRecordStatusSchema>;

export const ExecutionRecordSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  createdAt: z.string().datetime(),
  /** Full model output for this turn */
  rawResponse: z.string(),
  /** Text shown to the user (execution fences stripped) */
  assistantText: z.string(),
  /** First execution block (backward compatible with single-fence logs). */
  parsedBlock: ParsedExecutionBlockSchema.optional(),
  /** All execution blocks from one assistant turn (multi-fence). */
  parsedBlocks: z.array(ParsedExecutionBlockSchema).optional(),
  status: ExecutionRecordStatusSchema,
  errorMessage: z.string().optional(),
  durationMs: z.number().optional(),
  /** Set when a single widget was created from this execution */
  createdWidgetId: z.string().uuid().optional(),
  /** Set when multiple widgets were created (e.g. workspace.compose) */
  createdWidgetIds: z.array(z.string().uuid()).optional(),
  /** Result of a browser.* dispatch (distinct from BrowserAction log on the session). */
  browserDispatch: z
    .object({
      implemented: z.boolean(),
      message: z.string(),
    })
    .optional(),
  /** Skills whose instructions were injected for this chat turn (prompt routing). */
  activeSkillIds: z.array(z.string()).optional(),
  /** Estimated skill-section prompt footprint for this turn. */
  skillPromptMetrics: SkillPromptMetricsSchema.optional(),
  /** Binary PDFs produced by `export.pdf` in this turn (space-scoped download paths). */
  pdfExports: z
    .array(
      z.object({
        exportId: z.string().uuid(),
        filename: z.string(),
      }),
    )
    .optional(),
  /** PNG/WebP/JPEG files saved from OpenRouter image-model replies (`exports/<id>.<ext>`). */
  imageExports: z
    .array(
      z.object({
        exportId: z.string().uuid(),
        filename: z.string(),
      }),
    )
    .optional(),
});

export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;
