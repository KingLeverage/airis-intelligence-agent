import { z } from "zod";

/**
 * AIRIS persists UUIDs for spaces, widgets, snapshots, etc.
 * (Broader “non-uuid id” strings may appear in future artifact paths only.)
 */
export const UuidIdSchema = z.string().uuid();

/** Generic string id when integrating external systems or legacy data */
export const IdSchema = z.string().min(1);

export const IsoDateSchema = z.string().datetime();

export const VersionSchema = z.number().int().nonnegative();

/** Shared shape for versioned entities (aligns with SpaceMeta / WidgetRecord patterns). */
export const EntityMetaSchema = z.object({
  id: UuidIdSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  version: VersionSchema,
});

export type EntityMeta = z.infer<typeof EntityMetaSchema>;
