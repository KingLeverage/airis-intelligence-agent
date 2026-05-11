# Chart intelligence

- **Renderers:** `apps/web/src/features/widgets/charts/` — `ChartPanelWidgetView` composes `AirisPieChart` + `AirisCartesianChart` (SVG, no ad-hoc HTML). **Heatmap** and **timeline** live beside them as first-class panels.
- **Theme:** import `AIRIS_CHART_THEME` from `@airis/shared` for palette, grid, and panel chrome (`ChartPanelChrome`, grid lines).
- **Payload:** `chart-panel` — `subtitle`, `yLabel`, `comparisonMode`, `chartType` (`line`|`bar`|`area`|`pie`), `series[]`. **`heatmap-panel`** — matrix `cells` with row/col indices. **`timeline-panel`** — dated `events` with optional `tone`.

For new **executable** multi-widget layouts, add a branch in `expandDashboardRecipe` and extend `DASHBOARD_RECIPE_IDS`.
