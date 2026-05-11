import { z } from "zod";

export const EXPORT_PDF_MAX_CHART_EMBEDS = 8;

export const ExportPdfSectionSchema = z
  .object({
    heading: z.string().max(500).optional(),
    /** Prose for this section. May be empty when `chartWidgetId` is set (figure-only block). */
    body: z.string().max(24_000).default(""),
    /**
     * Optional widget id in the **same space** (`chart-panel`, `metric-grid`, or `comparison-panel`).
     * The server rasterizes supported kinds to PNG and embeds below the section body.
     */
    chartWidgetId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.body.trim() && !val.chartWidgetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "export_pdf_section_requires_body_or_chartWidgetId",
        path: ["body"],
      });
    }
  });

export const ExportPdfPayloadSchema = z.object({
  /** Shown on the first page of the PDF. */
  documentTitle: z.string().min(1).max(500),
  /** Optional download basename (`.pdf` added if missing). ASCII only after sanitize. */
  filename: z.string().max(180).optional(),
  sections: z.array(ExportPdfSectionSchema).min(1).max(64),
});

export type ExportPdfPayload = z.infer<typeof ExportPdfPayloadSchema>;

const MAX_TOTAL_CHARS = 200_000;

export function exportPdfPayloadTotalChars(p: ExportPdfPayload): number {
  let n = p.documentTitle.length;
  for (const s of p.sections) {
    n += (s.heading?.length ?? 0) + s.body.length;
  }
  return n;
}

export function countPdfChartEmbeds(p: ExportPdfPayload): number {
  return p.sections.reduce((acc, s) => acc + (s.chartWidgetId ? 1 : 0), 0);
}

export function assertPdfChartEmbedBudget(p: ExportPdfPayload): void {
  const n = countPdfChartEmbeds(p);
  if (n > EXPORT_PDF_MAX_CHART_EMBEDS) {
    throw new Error(
      `export_pdf_too_many_chart_embeds: max ${EXPORT_PDF_MAX_CHART_EMBEDS} chartWidgetId references, got ${n}`,
    );
  }
}

export function assertExportPdfPayloadSize(p: ExportPdfPayload): void {
  if (exportPdfPayloadTotalChars(p) > MAX_TOTAL_CHARS) {
    throw new Error(`export_pdf_payload_too_large: max ${MAX_TOTAL_CHARS} characters across all sections`);
  }
}
