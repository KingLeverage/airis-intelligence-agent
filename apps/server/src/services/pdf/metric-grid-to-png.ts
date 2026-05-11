import { createCanvas, type CanvasRenderingContext2D } from "canvas";
import { MetricGridPayloadSchema } from "@airis/shared";

const W = 920;
const PAD = 22;
const GAP = 10;
const MAX_METRICS = 48;

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function trendGlyph(t: "up" | "down" | "flat" | undefined): string {
  if (t === "up") return "▲";
  if (t === "down") return "▼";
  return "—";
}

function trendColor(t: "up" | "down" | "flat" | undefined): string {
  if (t === "up") return "#059669";
  if (t === "down") return "#e11d48";
  return "#64748b";
}

/** Rasterize `metric-grid` payload to PNG (white background, AIRIS-ish cards). */
export async function renderMetricGridToPng(raw: unknown): Promise<Buffer> {
  const parsed = MetricGridPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid_metric_grid_payload:${parsed.error.message.slice(0, 200)}`);
  }
  const metrics = (parsed.data.metrics ?? []).slice(0, MAX_METRICS);
  if (!metrics.length) {
    throw new Error("metric_grid_empty");
  }
  const cols = parsed.data.columns ?? 4;
  const rows = Math.ceil(metrics.length / cols);
  const rowH = 92;
  const H = Math.min(1600, PAD * 2 + rows * rowH + Math.max(0, rows - 1) * GAP);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const innerW = W - PAD * 2;
  const cellW = (innerW - (cols - 1) * GAP) / cols;

  for (let i = 0; i < metrics.length; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (cellW + GAP);
    const y = PAD + r * (rowH + GAP);
    const m = metrics[i];

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    fillRoundRect(ctx, x, y, cellW, rowH, 10);
    ctx.fill();
    fillRoundRect(ctx, x, y, cellW, rowH, 10);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    const label = (m.label ?? "").trim().slice(0, 80) || "—";
    ctx.fillText(label, x + 12, y + 22);

    ctx.fillStyle = "#0f172a";
    ctx.font = "600 20px sans-serif";
    const val = (m.value ?? "").trim().slice(0, 36) || "—";
    ctx.fillText(val, x + 12, y + 52);

    const trend = m.trend;
    const tg = trendGlyph(trend);
    ctx.fillStyle = trendColor(trend);
    ctx.font = "12px sans-serif";
    const delta = (m.delta ?? "").trim().slice(0, 24);
    const tail = delta ? ` ${delta}` : "";
    ctx.fillText(`${tg}${tail}`, x + 12, y + 78);
  }

  return canvas.toBuffer("image/png");
}
