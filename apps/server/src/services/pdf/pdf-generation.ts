import PDFDocument from "pdfkit";
import type { ExportPdfPayload } from "@airis/shared";

export function sanitizePdfFilename(raw: string | undefined, fallbackTitle: string): string {
  const base = (raw ?? fallbackTitle).trim().replace(/\.pdf$/i, "");
  const safe = base.replace(/[^a-zA-Z0-9._\-]+/g, "_").slice(0, 120) || "export";
  return `${safe}.pdf`;
}

/** Result of resolving a section's `chartWidgetId` — failures do not abort the PDF. */
export type ExportPdfChartEmbedResult =
  | { ok: true; png: Buffer; caption?: string }
  | { ok: false; message: string };

/** Resolves `chartWidgetId` in an export section to a PNG or a recoverable error message. */
export type ExportPdfChartContext = {
  resolveChartEmbed: (widgetId: string) => Promise<ExportPdfChartEmbedResult>;
};

export async function renderPdfBuffer(
  payload: ExportPdfPayload,
  chartCtx?: ExportPdfChartContext,
): Promise<Buffer> {
  const needsChartEmbed = payload.sections.some((s) => s.chartWidgetId);
  if (needsChartEmbed && !chartCtx) {
    throw new Error("export_pdf_chart_context_missing");
  }

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    margin: 50,
    size: "LETTER",
    info: { Title: payload.documentTitle.slice(0, 200) },
  });

  const bufPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica");
  doc.fontSize(20).fillColor("#0f172a").text(payload.documentTitle, { underline: true });
  doc.moveDown(1.1);
  doc.fontSize(11).fillColor("#334155");

  for (const s of payload.sections) {
    if (s.heading) {
      doc.moveDown(0.55).fontSize(14).fillColor("#0f172a").text(s.heading);
      doc.moveDown(0.3);
    }
    doc.fontSize(11).fillColor("#334155");
    if (s.body.trim()) {
      doc.text(s.body.replace(/\r\n/g, "\n"), {
        align: "left",
        lineGap: 2,
        paragraphGap: 4,
      });
      doc.moveDown(0.35);
    }
    if (s.chartWidgetId && chartCtx) {
      const embed = await chartCtx.resolveChartEmbed(s.chartWidgetId);
      if (embed.ok) {
        const margin = doc.page.margins;
        const contentW = doc.page.width - margin.left - margin.right;
        const fitW = contentW;
        const fitH = Math.min(400, contentW * 0.54);
        doc.image(embed.png, { fit: [fitW, fitH], align: "center" });
        if (embed.caption?.trim()) {
          doc.moveDown(0.28);
          doc.fontSize(9).fillColor("#64748b").text(embed.caption.trim().slice(0, 220), { align: "center" });
        }
        doc.moveDown(0.35);
      } else {
        doc.moveDown(0.2);
        doc
          .fontSize(9)
          .fillColor("#9a3412")
          .text(`[Chart not embedded: ${embed.message.slice(0, 260)}]`, {
            align: "left",
            lineGap: 2,
          });
        doc.moveDown(0.35);
      }
      doc.fontSize(11).fillColor("#334155");
    }
    doc.moveDown(0.45);
  }

  doc.end();
  return bufPromise;
}
