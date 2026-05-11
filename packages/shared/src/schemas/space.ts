import { z } from "zod";

export const SpaceMetaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** URL-safe slug from name at creation time; optional on legacy spaces */
  slug: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().nonnegative().default(0),
  /** Seeded demo / template workspace */
  demo: z.boolean().optional(),
  pinned: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  /** When true, opening from home clones into a non-demo workspace first */
  cloneOnOpen: z.boolean().optional(),
  /** Stable id matching `DEMO_SPACE_TEMPLATES` — used to avoid duplicate seeds */
  demoTemplateId: z.string().min(1).optional(),
  demoDescription: z.string().optional(),
  /** Matched against `DemoSpaceTemplate.contentRevision` to refresh seeded copy from templates. */
  demoContentRevision: z.number().int().nonnegative().optional(),
  /** ISO time of last persisted workspace canvas preview (`space-preview.jpg`). */
  previewUpdatedAt: z.string().datetime().optional(),
});

export type SpaceMeta = z.infer<typeof SpaceMetaSchema>;
