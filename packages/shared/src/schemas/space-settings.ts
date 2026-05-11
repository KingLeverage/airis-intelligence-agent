import { z } from "zod";

export const AirisThemeSchema = z.enum([
  "iris-deepfield",
  "pearl-observatory",
  "aurora-lens",
  "solar-archive",
  /** Legacy aliases kept so old settings files keep loading. */
  "dark",
  "light",
]);

export type AirisTheme = z.infer<typeof AirisThemeSchema>;

export const SpaceSettingsSchema = z.object({
  defaultModelId: z.string().optional(),
  theme: AirisThemeSchema.default("iris-deepfield"),
});

export type SpaceSettings = z.infer<typeof SpaceSettingsSchema>;
