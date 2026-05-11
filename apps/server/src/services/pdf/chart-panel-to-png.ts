import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import { AIRIS_CHART_THEME, ChartPanelPayloadSchema, type ChartPanelPayload } from "@airis/shared";

const RENDER_WIDTH = 920;
const RENDER_HEIGHT = 480;

const palette = [...AIRIS_CHART_THEME.series] as string[];

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildPieConfiguration(data: ChartPanelPayload): ChartConfiguration {
  const series = Array.isArray(data.series) ? data.series : [];
  const ps = series[0]?.points ?? [];
  if (!ps.length) {
    throw new Error("chart_panel_pie_empty");
  }
  const labels = ps.map((p) => String(p.x).trim() || "—");
  const values = ps.map((p) => (typeof p.y === "number" && Number.isFinite(p.y) ? p.y : 0));
  const colors = ps.map((p, i) => (p.color?.trim() ? p.color.trim() : palette[i % palette.length]));
  const inner = AIRIS_CHART_THEME.radii.pieInnerRatio;
  const useRing = inner > 0.001;
  const cfg: ChartConfiguration = {
    type: useRing ? "doughnut" : "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: AIRIS_CHART_THEME.surface.pieSliceStroke,
          borderWidth: 1,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 8, font: { size: 10 } },
        },
        title: data.subtitle?.trim()
          ? { display: true, text: data.subtitle.trim().slice(0, 180), font: { size: 12 } }
          : { display: false },
      },
      ...(useRing ? { cutout: `${Math.round(inner * 100)}%` } : {}),
    },
  };
  return cfg;
}

function orderedCategoryLabels(series: ChartPanelPayload["series"]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const ser of series) {
    for (const pt of ser.points ?? []) {
      const x = String(pt.x);
      if (!seen.has(x)) {
        seen.add(x);
        labels.push(x);
      }
    }
  }
  return labels;
}

function buildCartesianConfiguration(data: ChartPanelPayload): ChartConfiguration {
  const chartType =
    data.chartType === "bar" || data.chartType === "area" || data.chartType === "line"
      ? data.chartType
      : "line";
  const series = Array.isArray(data.series) ? data.series : [];
  if (!series.length) {
    throw new Error("chart_panel_series_empty");
  }
  const labels = orderedCategoryLabels(series);
  if (!labels.length) {
    throw new Error("chart_panel_no_category_points");
  }

  const gridColor = AIRIS_CHART_THEME.grid.line;
  const datasets = series.map((ser, idx) => {
    const color = ser.color?.trim() || palette[idx % palette.length];
    const m = new Map((ser.points ?? []).map((pt) => [String(pt.x), pt]));
    const vals = labels.map((x) => {
      const pt = m.get(x);
      if (!pt) return null;
      return typeof pt.y === "number" && Number.isFinite(pt.y) ? pt.y : null;
    });
    if (chartType === "bar") {
      return {
        label: ser.label || `Series ${idx + 1}`,
        data: vals,
        backgroundColor: hexToRgba(color, 0.78),
        borderColor: color,
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 48,
      };
    }
    return {
      label: ser.label || `Series ${idx + 1}`,
      data: vals,
      borderColor: color,
      backgroundColor: chartType === "area" ? hexToRgba(color, 0.22) : "transparent",
      borderWidth: 2,
      fill: chartType === "area" ? ("origin" as const) : false,
      tension: 0.22,
      pointRadius: 3,
      pointBackgroundColor: color,
    };
  });

  const yTitle = typeof data.yLabel === "string" && data.yLabel.trim() ? data.yLabel.trim().slice(0, 80) : undefined;

  const cfg: ChartConfiguration = {
    type: chartType === "bar" ? "bar" : "line",
    data: { labels, datasets },
    options: {
      responsive: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } },
        title: data.subtitle?.trim()
          ? { display: true, text: data.subtitle.trim().slice(0, 180), font: { size: 12 } }
          : { display: false },
      },
      scales: {
        x: {
          ticks: { maxRotation: 40, minRotation: 0, autoSkip: true, maxTicksLimit: 20, font: { size: 10 } },
          grid: { color: gridColor },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10 } },
          grid: { color: gridColor },
          title: yTitle ? { display: true, text: yTitle, font: { size: 11 } } : { display: false },
        },
      },
    },
  };
  return cfg;
}

export function chartPanelPayloadToConfiguration(data: ChartPanelPayload): ChartConfiguration {
  const chartType =
    data.chartType === "pie" ? "pie" : data.chartType === "bar" || data.chartType === "area" || data.chartType === "line"
      ? data.chartType
      : "line";
  if (chartType === "pie") {
    return buildPieConfiguration(data);
  }
  return buildCartesianConfiguration(data);
}

/** Rasterize a validated `chart-panel` payload to PNG (white background). */
export async function renderChartPanelToPng(raw: unknown): Promise<Buffer> {
  const parsed = ChartPanelPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid_chart_panel_payload:${parsed.error.message.slice(0, 220)}`);
  }
  const configuration = chartPanelPayloadToConfiguration(parsed.data);
  const renderer = new ChartJSNodeCanvas({
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
    backgroundColour: "#ffffff",
  });
  return renderer.renderToBuffer(configuration);
}
