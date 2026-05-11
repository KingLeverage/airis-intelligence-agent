import { AIRIS_CHART_THEME } from "@airis/shared";

export function normalizeSeries(points: { x: string; y: number }[]) {
  if (points.length === 0) return { lineD: "", areaD: "", minY: 0, maxY: 1 };
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const n = points.length;
  const pts = points.map((p, i) => {
    const x = (i / Math.max(1, n - 1)) * 100;
    const yNorm = 34 - ((p.y - minY) / span) * 28;
    return { x, y: yNorm };
  });
  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    pts.length > 0
      ? `M 0 36 L ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} L 100 36 Z`
      : "";
  return { lineD, areaD, minY, maxY };
}

export const SERIES_COLORS = [...AIRIS_CHART_THEME.series];

export function pieSliceFill(
  i: number,
  pt: { color?: string },
  seriesColor: string | undefined,
  palette: string[],
): string {
  return pt.color ?? seriesColor ?? palette[i % palette.length];
}

export type PieSliceDesc = { d: string; fill: string };

export function buildPieSliceDescriptors(
  points: { x: string; y: number; color?: string }[],
  seriesColor: string | undefined,
  palette: string[],
): PieSliceDesc[] {
  const vals = points.map((p) => Math.max(0, Number(p.y) || 0));
  const sum = vals.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;
  const cx = 50;
  const cy = 50;
  const r = 40;
  return vals.map((v, i) => {
    const frac = v / sum;
    const a0 = angle;
    const a1 = angle + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const largeArc = frac > 0.5 ? 1 : 0;
    angle = a1;
    const d = `M ${cx} ${cy} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
    const fill = pieSliceFill(i, points[i]!, seriesColor, palette);
    return { d, fill };
  });
}

export const PIE_SLICE_STROKE = AIRIS_CHART_THEME.surface.pieSliceStroke;
