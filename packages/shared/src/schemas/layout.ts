import { z } from "zod";
import { DashboardRecipeSchema as DashboardRecipeSchemaFromRegistry } from "../layout/dashboard-recipes.js";

export const LayoutPresetSchema = z.enum([
  "single-focus",
  "two-column",
  "wide-header-two-column",
  "dashboard-quartet",
  "stacked-feed",
]);

export type LayoutPreset = z.infer<typeof LayoutPresetSchema>;

export const WidgetLayoutEntrySchema = z.object({
  widgetId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  zIndex: z.number().int().optional(),
});

export const WidgetPlacementSchema = WidgetLayoutEntrySchema.extend({
  preset: LayoutPresetSchema.optional(),
});

export const DashboardRecipeSchema = DashboardRecipeSchemaFromRegistry;

export const LayoutStateSchema = z.object({
  widgets: z.array(WidgetLayoutEntrySchema),
});

export type LayoutState = z.infer<typeof LayoutStateSchema>;
export type WidgetLayoutEntry = z.infer<typeof WidgetLayoutEntrySchema>;
export type WidgetPlacement = z.infer<typeof WidgetPlacementSchema>;
export type DashboardRecipe = z.infer<typeof DashboardRecipeSchema>;
