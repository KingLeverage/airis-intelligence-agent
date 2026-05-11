/**
 * Chart / dashboard **intelligence** metadata: teaches the model *when* to pick patterns.
 * Executable layouts live in `layout/dashboard-recipes.ts` (`workspace.compose` `recipe` ids).
 */
export type ChartWidgetRecipeMeta = {
  id: string;
  title: string;
  /** Prefer matching `workspace.compose` recipe id when it exists. */
  workspaceRecipeId?: string;
  preferredKinds: string[];
  whenToUse: string;
  whenNotToUse: string;
  dataShape: string;
  tags: string[];
};

export const CHART_WIDGET_RECIPE_CATALOG: ChartWidgetRecipeMeta[] = [
  {
    id: "donut-distribution",
    title: "Donut / pie distribution",
    workspaceRecipeId: "donut-distribution-board",
    preferredKinds: ["chart-panel", "metric-grid", "research-card"],
    whenToUse: "Part-to-whole shares (3–7 slices), mix proportions, survey weights.",
    whenNotToUse: "Many categories (>8) or precise rank ordering — use bars instead.",
    dataShape: "`chartType: pie`, one series, points `{x, y}` as slice label + value.",
    tags: ["distribution", "share", "pie"],
  },
  {
    id: "grouped-bar-comparison",
    title: "Grouped bar comparison",
    workspaceRecipeId: "grouped-bar-insight",
    preferredKinds: ["chart-panel", "metric-grid"],
    whenToUse: "Side-by-side metrics across a shared set of categories (A vs B vs C).",
    whenNotToUse: "Single series time index — use line/area.",
    dataShape: "`chartType: bar`, `comparisonMode: true`, multiple series aligned on `points[].x`.",
    tags: ["comparison", "bar", "categorical"],
  },
  {
    id: "stacked-trend",
    title: "Stacked trend (area emphasis)",
    workspaceRecipeId: "stacked-trend-kpi",
    preferredKinds: ["chart-panel", "metric-grid"],
    whenToUse: "Composition or level changing over ordered periods (quarters, weeks).",
    whenNotToUse: "Unrelated metrics on different scales without normalization.",
    dataShape: "`chartType: area`, one or more series with same x keys.",
    tags: ["trend", "time", "area"],
  },
  {
    id: "ranked-bars",
    title: "Ranked horizontal emphasis",
    workspaceRecipeId: "ranked-bars-dashboard",
    preferredKinds: ["chart-panel", "research-card"],
    whenToUse: "Ordered leaderboard, severity, scores — longest bar = rank #1.",
    whenNotToUse: "Circular/cyclical data (use donut).",
    dataShape: "`chartType: bar`, sort points descending by `y` in payload.",
    tags: ["rank", "leaderboard", "bar"],
  },
  {
    id: "metric-strip",
    title: "Metric strip + hero chart",
    workspaceRecipeId: "metric-strip-line-focus",
    preferredKinds: ["metric-grid", "chart-panel"],
    whenToUse: "KPI row above a primary trend or comparison chart.",
    whenNotToUse: "Deep narrative — pair with `research-card` instead of more KPIs.",
    dataShape: "`metric-grid` columns 3–4 + `chart-panel` line/area.",
    tags: ["kpi", "strip", "dashboard"],
  },
  {
    id: "dual-chart-composition",
    title: "Dual chart composition",
    workspaceRecipeId: "dual-chart-composition",
    preferredKinds: ["chart-panel", "metric-grid"],
    whenToUse: "Primary insight chart plus supporting chart (e.g. mix + trend).",
    whenNotToUse: "One chart suffices — avoid duplicate encodings.",
    dataShape: "Two `chart-panel` widgets with distinct `chartType` / titles.",
    tags: ["composition", "pair", "layout"],
  },
  {
    id: "evidence-summary",
    title: "Evidence + comparison matrix",
    workspaceRecipeId: "evidence-comparison-row",
    preferredKinds: ["comparison-panel", "research-card", "news-feed"],
    whenToUse: "Claims vs sources, hypothesis vs null, option A vs B with citations.",
    whenNotToUse: "Pure time-series forecasting without categorical lens.",
    dataShape: "`comparison-panel` entities + `research-card` bullets + optional `news-feed`.",
    tags: ["evidence", "matrix", "research"],
  },
  {
    id: "findings-card",
    title: "Findings + intel stream",
    workspaceRecipeId: "findings-metrics-news",
    preferredKinds: ["metric-grid", "research-card", "news-feed"],
    whenToUse: "Executive readout: KPIs, narrative synthesis, live-ish headlines.",
    whenNotToUse: "Dense tabular numeric compare — prefer `comparison-panel`.",
    dataShape: "KPI row + `research-card` summary + `news-feed` items with ids.",
    tags: ["briefing", "exec", "narrative"],
  },
  {
    id: "research-timeline-intel",
    title: "Timeline / intel stack",
    workspaceRecipeId: "research-timeline-intel",
    preferredKinds: ["timeline-panel", "chart-panel", "checklist"],
    whenToUse: "Chronological intel, milestone tracking, reading list + sparkline context.",
    whenNotToUse: "Static single-number dashboards.",
    dataShape: "`timeline-panel` events `{ id, at, title, tone? }` + `chart-panel` line + checklist.",
    tags: ["timeline", "intel", "feed"],
  },
  {
    id: "geo-heatmap-brief",
    title: "Geographic / regional heatmap + synthesis",
    workspaceRecipeId: "geo-heatmap-brief",
    preferredKinds: ["heatmap-panel", "research-card", "metric-grid"],
    whenToUse:
      "User wants a **regional matrix** plus written summary in one pass (market share by geography, adoption by territory, etc.).",
    whenNotToUse: "Single-region single-metric — a bar chart may suffice.",
    dataShape: "Recipe `geo-heatmap-brief` or custom `heatmap-panel` with geographic `rowLabels` + metric `colLabels` + `cells: [{r,c,v}]` + `research-card`.",
    tags: ["geography", "heatmap", "matrix", "brief"],
  },
  {
    id: "risk-heatmap-matrix",
    title: "Risk heatmap matrix",
    workspaceRecipeId: "risk-heatmap-board",
    preferredKinds: ["heatmap-panel", "metric-grid", "research-card"],
    whenToUse: "Two-dimensional scores (region×signal, control×gap) with KPI strip and narrative.",
    whenNotToUse: "Simple rank order of one variable — prefer ranked bars.",
    dataShape: "`heatmap-panel` rowLabels, colLabels, cells `{r,c,v}` + KPI grid + synthesis card.",
    tags: ["risk", "heatmap", "matrix"],
  },
  {
    id: "milestone-timeline-delivery",
    title: "Milestone timeline + burndown",
    workspaceRecipeId: "milestone-timeline-board",
    preferredKinds: ["timeline-panel", "chart-panel", "metric-grid"],
    whenToUse: "Program reviews: dated milestones with semantic tones plus a trend or burndown chart.",
    whenNotToUse: "Headline-only news without dates — use `news-feed` instead.",
    dataShape: "`timeline-panel` + `chart-panel` area/line + `metric-grid` strip.",
    tags: ["milestone", "delivery", "program"],
  },
  {
    id: "pet-allergy-research",
    title: "Pet / allergy research hub (flagship)",
    workspaceRecipeId: "pet-allergy-research-hub",
    preferredKinds: ["metric-grid", "chart-panel", "research-card", "comparison-panel"],
    whenToUse: "Environmental + symptom framing (dander, HEPA, symptom mix, treatment comparison).",
    whenNotToUse: "Unrelated domains — clone pattern for other clinical vignettes.",
    dataShape: "KPI strip + donut symptoms + prose synthesis + 2-column comparison.",
    tags: ["health", "pet", "allergy", "flagship"],
  },
];
