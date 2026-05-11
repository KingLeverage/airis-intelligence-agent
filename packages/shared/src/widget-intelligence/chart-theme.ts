/**
 * AIRIS chart design tokens — shared by prompts and the web chart renderer.
 * Keep values hex/rgba for SVG `stroke` / `fill` and Tailwind arbitrary colors.
 */
export const AIRIS_CHART_THEME = {
  surface: {
    panelBg: "rgba(2,6,23,0.72)",
    panelBorder: "rgba(56,189,248,0.12)",
    panelRing: "rgba(255,255,255,0.06)",
    panelInsetHighlight: "rgba(34,211,238,0.05)",
    /** Pie slice separators */
    pieSliceStroke: "rgba(15,23,42,0.88)",
  },
  grid: {
    line: "rgba(148,163,184,0.14)",
    lineBold: "rgba(148,163,184,0.22)",
  },
  axis: {
    label: "rgba(148,163,184,0.78)",
    tick: "rgba(148,163,184,0.45)",
  },
  semantic: {
    positive: "#34d399",
    negative: "#fb7185",
    warning: "#fbbf24",
    neutral: "#94a3b8",
  },
  /** Up to 8 categorical series — cool / iris aligned, not default rainbow. */
  series: [
    "#5eead4",
    "#a78bfa",
    "#fbbf24",
    "#fb7185",
    "#38bdf8",
    "#c4b5fd",
    "#f472b6",
    "#2dd4bf",
  ],
  typography: {
    yLabel: "text-[10px] uppercase tracking-[0.18em] text-slate-500",
    legend: "text-[10px] text-slate-400",
    subtitle: "text-[11px] leading-snug text-slate-500",
  },
  radii: {
    barPx: 0.35,
    pieInnerRatio: 0.41,
  },
} as const;

export type AirisChartTheme = typeof AIRIS_CHART_THEME;
