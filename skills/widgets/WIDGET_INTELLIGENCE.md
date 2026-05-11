# Widget intelligence

Canonical **recipe ids** and **chart tokens** live in `@airis/shared`:

- `layout/dashboard-recipes.ts` — `DASHBOARD_RECIPE_IDS`, `expandDashboardRecipe()`
- `widget-intelligence/chart-theme.ts` — `AIRIS_CHART_THEME`
- `widget-intelligence/chart-recipes.ts` — `CHART_WIDGET_RECIPE_CATALOG` (when-to-use metadata)
- `widget-intelligence/prompt-section.ts` — appended to `buildWidgetPromptRules()` for the LLM

**Generation rule:** prefer `workspace.compose` with `payload: { "recipe": "<id>" }`, then edit payloads. Avoid inventing novel chart geometry from scratch. For **regional / geographic heatmap + written synthesis** in one shot, use recipe **`geo-heatmap-brief`** (then `widget.update` to swap in real numbers).

**Kinds beyond `chart-panel`:**

- **`heatmap-panel`** — matrix intensity (`rowLabels`, `colLabels`, `cells: [{ r, c, v }]`). See recipe `risk-heatmap-board`.
- **`timeline-panel`** — vertical milestones (`events: [{ id, at, title, detail?, tone? }]`). See `research-timeline-intel`, `milestone-timeline-board`.

**Multimodal references:** HTTP `GET/POST /api/reference-library*` — PDF text extract, optional `AIRIS_EMBEDDING_MODEL` hybrid search + chat RAG, optional `AIRIS_VISION_CAPTION_MODEL` for `autoCaption` on images. See `apps/server/AGENTS.md` and `apps/server/.env.example`.
