import { defaultLayoutForKind } from "@airis/shared";
import * as store from "../../persistence/space-store.js";
import { createWidgetForSpace } from "../widgets/widget-mutations.js";

export function appendImageExportMarkdownFootnote(
  spaceId: string,
  base: string,
  exports: { exportId: string; filename: string }[],
): string {
  if (exports.length === 0) return base;
  const lines = exports.map((e) => {
    const href = `/api/spaces/${spaceId}/exports/image/${e.exportId}?filename=${encodeURIComponent(e.filename)}`;
    return `- **${e.filename}** — [open / download](${href})`;
  });
  return `${base.trimEnd()}\n\n---\n**Saved to Exports & workspace canvas**\n${lines.join("\n")}\n`;
}

async function nextImageWidgetLayout(
  spaceId: string,
  userId: string,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const def = defaultLayoutForKind("html-card");
  const widgets = await store.listWidgetRecords(spaceId, userId);
  let maxY = 0;
  for (const w of widgets) {
    const y = w.layout?.y ?? 0;
    const h = w.layout?.h ?? 3;
    maxY = Math.max(maxY, y + h);
  }
  return { x: 0, y: maxY, w: def.w, h: def.h };
}

/**
 * Create an `html-card` per saved export so the image appears on the workspace grid
 * with preview + download link (same `/api/…/exports/image/…` URL).
 */
export async function createHtmlCardWidgetsForImageExports(opts: {
  spaceId: string;
  userId: string;
  imageExports: { exportId: string; filename: string }[];
}): Promise<string[]> {
  const { spaceId, userId, imageExports } = opts;
  const ids: string[] = [];
  for (const img of imageExports) {
    const href = `/api/spaces/${spaceId}/exports/image/${img.exportId}?filename=${encodeURIComponent(img.filename)}`;
    const html = `<figure style="margin:0"><a href="${href}" download><img src="${href}" alt="Generated image" style="width:100%;height:auto;object-fit:contain;border-radius:8px;border:1px solid rgba(148,163,184,0.35)" /></a><figcaption style="margin-top:0.6rem;font-size:12px;opacity:0.85"><a href="${href}" download>Download ${escapeHtml(
      img.filename,
    )}</a></figcaption></figure>`;
    const layout = await nextImageWidgetLayout(spaceId, userId);
    const title = `Generated: ${img.filename.replace(/\.[a-z]+$/i, "") || "image"}`;
    const created = await createWidgetForSpace(
      spaceId,
      {
        kind: "html-card",
        title,
        data: { html, plain: `Generated image ${img.filename}` },
        layout,
      },
      userId,
    );
    if (created.ok) {
      ids.push(created.widget.id);
    }
  }
  return ids;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
