# Design tokens (charts)

Source of truth: `packages/shared/src/widget-intelligence/chart-theme.ts` (`AIRIS_CHART_THEME`).

Tailwind in the web app should **reference** these values for chart-adjacent UI (legends, subtitles) to stay aligned with SVG fills/strokes.

**Heatmap / timeline:** `heatmap-panel` uses an HSL scale derived from the same cool→warm intent as the chart palette (`apps/web/.../charts/HeatmapPanelWidgetView.tsx`). `timeline-panel` uses semantic Tailwind rings (`risk` / `win` / `milestone` / `neutral`) aligned with `AIRIS_CHART_THEME.semantic` hues.
