import { createCanvas } from "canvas";
import { ComparisonPanelPayloadSchema } from "@airis/shared";

const W = 920;
const PAD = 20;
const MAX_ENTITIES = 8;
const MAX_KEYS = 28;

/** Rasterize `comparison-panel` as a simple table (no remote avatar images). */
export async function renderComparisonPanelToPng(raw: unknown): Promise<Buffer> {
  const parsed = ComparisonPanelPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid_comparison_panel_payload:${parsed.error.message.slice(0, 200)}`);
  }
  const entities = (parsed.data.entities ?? []).slice(0, MAX_ENTITIES);
  if (!entities.length) {
    throw new Error("comparison_panel_empty");
  }

  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (const e of entities) {
    for (const row of e.metrics) {
      const k = String(row.key ?? "").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      keyOrder.push(k);
    }
  }
  const keys = keyOrder.slice(0, MAX_KEYS);
  if (!keys.length) {
    throw new Error("comparison_panel_no_metrics");
  }

  function valueFor(entityIdx: number, key: string): string {
    const ent = entities[entityIdx];
    const hit = ent.metrics.find((m) => String(m.key).trim() === key);
    return (hit?.value ?? "—").toString().trim().slice(0, 48) || "—";
  }

  const firstColW = 168;
  const dataCols = entities.length;
  const usable = W - PAD * 2 - firstColW;
  const colW = Math.max(90, Math.floor((usable - (dataCols - 1) * 6) / Math.max(1, dataCols)));

  const headerH = 42;
  const rowH = 34;
  const H = Math.min(1600, PAD * 2 + headerH + keys.length * rowH + 12);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(PAD, PAD, W - PAD * 2, headerH);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 12px sans-serif";
  ctx.fillText("Metric", PAD + 10, PAD + 27);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 11px sans-serif";
  for (let j = 0; j < entities.length; j++) {
    const x = PAD + firstColW + j * (colW + 6);
    const label = (entities[j].label ?? "").trim().slice(0, 26) || `Column ${j + 1}`;
    ctx.fillText(label, x + 6, PAD + 27);
  }

  let y = PAD + headerH;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(PAD, y, W - PAD * 2, rowH);
    }
    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    ctx.fillText(key.slice(0, 44), PAD + 10, y + 22);
    ctx.fillStyle = "#0f172a";
    for (let j = 0; j < entities.length; j++) {
      const x = PAD + firstColW + j * (colW + 6);
      ctx.fillText(valueFor(j, key), x + 6, y + 22);
    }
    y += rowH;
  }

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD + 0.5, PAD + 0.5, W - PAD * 2 - 1, H - PAD * 2 - 1);

  return canvas.toBuffer("image/png");
}
