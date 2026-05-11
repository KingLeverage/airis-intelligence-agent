import { z } from "zod";
import { SnapshotMetaSchema } from "./snapshot.js";

export const RecoveryEventKindSchema = z.enum([
  "parse_error",
  "validation_error",
  "load_error",
  "restore",
  "widget_disabled",
]);

export const RecoveryEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  spaceId: z.string().uuid().optional(),
  kind: RecoveryEventKindSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type RecoveryEvent = z.infer<typeof RecoveryEventSchema>;

export const RecoveryIssueSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  severity: z.enum(["warning", "error"]),
  entityType: z.enum(["space", "settings", "widget", "snapshot", "instructions"]),
  entityId: z.string().optional(),
  message: z.string(),
  detectedAt: z.string().datetime(),
});

export type RecoveryIssue = z.infer<typeof RecoveryIssueSchema>;

export const RecoverySummarySchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string(),
  issues: z.array(RecoveryIssueSchema),
  snapshotCount: z.number().int().nonnegative(),
  widgetCount: z.number().int().nonnegative(),
  invalidWidgetCount: z.number().int().nonnegative(),
  invalidSnapshotCount: z.number().int().nonnegative().optional(),
  loadError: z.string().optional(),
});

export type RecoverySummary = z.infer<typeof RecoverySummarySchema>;

export const SpaceRecoveryDetailSchema = RecoverySummarySchema.extend({
  snapshots: z.array(SnapshotMetaSchema),
  brokenWidgets: z.array(
    z.object({
      id: z.string(),
      file: z.string(),
      error: z.string(),
    }),
  ),
});

export type SpaceRecoveryDetail = z.infer<typeof SpaceRecoveryDetailSchema>;
