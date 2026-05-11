import { z } from "zod";
import { AirisThemeSchema } from "./space-settings.js";

export const GlobalSettingsSchema = z.object({
  defaultModelId: z.string().optional(),
  theme: AirisThemeSchema.default("iris-deepfield"),
});

export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;

export const ModelDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(["mock", "anthropic", "openai-compatible"]),
  model: z.string(),
});

export const ModelsFileSchema = z.object({
  models: z.array(ModelDescriptorSchema),
});

export type ModelDescriptor = z.infer<typeof ModelDescriptorSchema>;
