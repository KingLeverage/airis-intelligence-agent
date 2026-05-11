import { z } from "zod";

/** Standard success envelope for REST JSON in this phase (spaces + widgets). */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorBodySchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export type ApiSuccess<T> = { ok: true; data: T };
