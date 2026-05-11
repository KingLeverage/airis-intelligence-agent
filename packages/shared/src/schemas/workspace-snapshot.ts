import { z } from "zod";

/** Single widget row in a workspace snapshot sent with embedded agent requests. */
export const WorkspaceSnapshotWidgetSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string().optional(),
  /** Short summary for situational awareness (client-truncated). */
  summary: z.string().max(200).optional(),
});

export type WorkspaceSnapshotWidget = z.infer<typeof WorkspaceSnapshotWidgetSchema>;

export const WorkspaceSnapshotSchema = z.object({
  spaceId: z.string().uuid(),
  widgets: z.array(WorkspaceSnapshotWidgetSchema),
  activeWidgetId: z.string().uuid().optional(),
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;
