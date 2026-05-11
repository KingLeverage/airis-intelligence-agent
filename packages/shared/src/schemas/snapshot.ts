import { z } from "zod";
import { BrowserSessionSchema } from "./browser.js";
import { ChatMessageSchema } from "./chat.js";
import { LayoutStateSchema } from "./layout.js";
import { SpaceMetaSchema } from "./space.js";
import { SpaceSettingsSchema } from "./space-settings.js";
import { WidgetRecordSchema } from "./widget.js";
import { SpaceSkillConfigSchema } from "./skill.js";

export const SnapshotReasonSchema = z.enum(["manual", "mutation", "pre-restore"]);

export const SnapshotMetaSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  createdAt: z.string().datetime(),
  reason: SnapshotReasonSchema,
  /** Human-readable line, e.g. "widget.create: note" */
  label: z.string().optional(),
  affectedEntityIds: z.array(z.string()).default([]),
  parentSnapshotId: z.string().uuid().optional(),
  /** Counts at capture time for UI / recovery */
  metadata: z
    .object({
      widgetCount: z.number().int().nonnegative(),
      chatMessageCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

/** Validates persisted snapshots/index.json */
export const SnapshotIndexSchema = z.array(SnapshotMetaSchema);

/** Full snapshot file on disk (flat layout for backwards compatibility). */
export const SnapshotBundleSchema = z.object({
  meta: SnapshotMetaSchema,
  space: SpaceMetaSchema,
  settings: SpaceSettingsSchema,
  layout: LayoutStateSchema,
  widgets: z.array(WidgetRecordSchema),
  chatTail: z.array(ChatMessageSchema).optional(),
  /** Captured instructions.md body when present */
  instructions: z.string().optional(),
  /** Optional browser workspace session (browser-session.json) */
  browserSession: BrowserSessionSchema.optional(),
  /** Optional per-space skill enablement (skills.json) */
  spaceSkills: SpaceSkillConfigSchema.optional(),
});

export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>;
export type SnapshotBundle = z.infer<typeof SnapshotBundleSchema>;
