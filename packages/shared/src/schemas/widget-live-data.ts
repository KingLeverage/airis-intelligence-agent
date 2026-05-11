import { z } from "zod";

/** Server → client: merge `dataPatch` into widget `data` for display (optional persist). */
export const WidgetLiveDataResponseSchema = z.object({
  dataPatch: z.record(z.unknown()),
  asOf: z.string(),
  sourceKey: z.string().optional(),
  /** When the key is unknown or kind mismatched */
  warning: z.string().optional(),
});

export type WidgetLiveDataResponse = z.infer<typeof WidgetLiveDataResponseSchema>;
