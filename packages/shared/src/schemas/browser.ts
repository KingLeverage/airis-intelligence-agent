import { z } from "zod";

/** Stable reference id within one transcription (e.g. e0, e1). */
export const InteractiveElementIdSchema = z.string().regex(/^e\d+$/);

export const InteractiveElementSchema = z.object({
  id: InteractiveElementIdSchema,
  role: z.string(),
  label: z.string(),
  text: z.string().optional(),
  selectorHint: z.string().optional(),
});

export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;

export const BrowserFormFieldSchema = z.object({
  id: z.string().regex(/^f\d+$/),
  label: z.string(),
  type: z.string(),
  valueHint: z.string().optional(),
});

export type BrowserFormField = z.infer<typeof BrowserFormFieldSchema>;

export const BrowserPageTranscriptionSchema = z.object({
  url: z.string(),
  title: z.string(),
  visibleTextSummary: z.string(),
  interactiveElements: z.array(InteractiveElementSchema),
  forms: z.array(BrowserFormFieldSchema),
  scrollPosition: z.number().default(0),
  capturedAt: z.string().datetime(),
});

export type BrowserPageTranscription = z.infer<typeof BrowserPageTranscriptionSchema>;

export const BrowserActionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("navigate"),
    url: z.string(),
    createdAt: z.string().datetime(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("click"),
    targetId: z.string(),
    createdAt: z.string().datetime(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("type"),
    targetId: z.string(),
    text: z.string(),
    createdAt: z.string().datetime(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("scroll"),
    amount: z.number(),
    createdAt: z.string().datetime(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("back"),
    createdAt: z.string().datetime(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("evaluate"),
    /** Truncated script body for logs / prompts (not full source). */
    scriptPreview: z.string().max(600),
    createdAt: z.string().datetime(),
  }),
]);

export type BrowserAction = z.infer<typeof BrowserActionSchema>;

export const BrowserSessionSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  currentUrl: z.string().optional(),
  /** Prior URLs for browser.back (server-side fetch model; not full browser history). */
  navigationStack: z.array(z.string()).default([]),
  lastTranscription: BrowserPageTranscriptionSchema.optional(),
  actions: z.array(BrowserActionSchema),
});

export type BrowserSession = z.infer<typeof BrowserSessionSchema>;

/** @deprecated Use InteractiveElementSchema */
export const BrowserInteractiveElementSchema = InteractiveElementSchema;
