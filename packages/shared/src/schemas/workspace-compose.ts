import { z } from "zod";
import { DashboardRecipeSchema } from "../layout/dashboard-recipes.js";
import {
  WidgetDataSourceConfigSchema,
  WidgetKindSchema,
  WidgetRenderConfigSchema,
} from "./widget.js";

export const WorkspaceComposeWidgetEntrySchema = z.object({
  widgetKind: WidgetKindSchema,
  title: z.string(),
  payload: z.record(z.unknown()),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  renderConfig: WidgetRenderConfigSchema.optional(),
  authoringNote: z.string().optional(),
  dataSource: WidgetDataSourceConfigSchema.optional(),
});

export type WorkspaceComposeWidgetEntry = z.infer<typeof WorkspaceComposeWidgetEntrySchema>;

export const WorkspaceComposePayloadSchema = z
  .object({
    recipe: DashboardRecipeSchema.optional(),
    widgets: z.array(WorkspaceComposeWidgetEntrySchema).optional(),
  })
  .refine(
    (v) =>
      (v.recipe != null && (v.widgets == null || v.widgets.length === 0)) ||
      (v.recipe == null && v.widgets != null && v.widgets.length > 0),
    {
      message:
        "workspace.compose: set exactly one of `recipe` (canned layout) or `widgets` (explicit list), not both",
    },
  );

export type WorkspaceComposePayload = z.infer<typeof WorkspaceComposePayloadSchema>;
