import { CHART_WIDGET_RECIPE_CATALOG } from "./chart-recipes.js";
import { DASHBOARD_RECIPE_IDS } from "../layout/dashboard-recipes.js";

/**
 * Appended to system widget rules — steers the model to **select recipes first**.
 */
export function buildWidgetIntelligencePromptSection(): string {
  const lines = CHART_WIDGET_RECIPE_CATALOG.map((r) => {
    const wr = r.workspaceRecipeId ? ` → \`{"recipe":"${r.workspaceRecipeId}"}\`` : "";
    return `- **${r.id}** (${r.title})${wr}\n  - Use when: ${r.whenToUse}\n  - Avoid when: ${r.whenNotToUse}\n  - Data: ${r.dataShape}\n  - Tags: ${r.tags.join(", ")}`;
  });

  return [
    "### AIRIS widget intelligence (same-day rules)",
    "0. **Ship now:** If the user asks for summaries, heatmaps (including geographic/regional matrices), or dashboards, emit **`<<<EXECUTION`** blocks in the **same** reply — do not claim the workspace cannot build heatmaps or defer widgets. Prefer recipe **`geo-heatmap-brief`** for region×metric + synthesis, or **`risk-heatmap-board`**, or explicit `widgets[]`.",
    "1. Prefer **`workspace.compose`** with a **`recipe`** from the catalog below instead of inventing ad-hoc widget shapes.",
    "2. Only after a recipe fits, **customize payloads** (series points, metrics text, citations) — keep structure.",
    "3. Charts use the **AIRIS dark palette** (see renderer); pass explicit `series[].color` only when you need emphasis, else defaults apply.",
    "4. For premium dashboards combine **metric-grid (KPI strip) + chart-panel + research-card | comparison-panel** rather than many orphan charts.",
    "",
    "**Registered `recipe` ids (workspace.compose):**",
    DASHBOARD_RECIPE_IDS.map((id) => `- \`${id}\``).join("\n"),
    "",
    "**Pattern catalog (map to recipe id when present):**",
    ...lines,
    "",
    "**Multimodal reference library (wired):** server stores uploads under the user data dir. **List / search / ingest / download** — same HTTP paths as before; PDFs populate `textExtract` via `pdf-parse`. **Hybrid search** activates when `AIRIS_EMBEDDING_MODEL` + API keys are set (vectors in `files/<id>/embedding.json`). **Chat context:** top hits are merged into the system prompt unless `AIRIS_REFERENCE_RAG_PROMPT=0`. **Vision captions** on ingest when multipart `autoCaption=1` and `AIRIS_VISION_CAPTION_MODEL` is set. **Reindex:** `POST /api/reference-library/reindex-embeddings`.",
    "",
    "5. **html-card + YouTube:** Every `youtube.com/embed/VIDEO_ID` (and matching `watch?v=`) must use a **verified** id from Browser transcription/URLs (after `browser.navigate` to YouTube or Google video results), the **user’s links**, or **citations** — never invent ids, never reuse meme/placeholder ids (server **rejects** the canonical Rick-roll id). Do **not** label the card as “example”, “demonstration”, or “placeholder” when the user asked for real videos. If ids are not in context yet, **`browser.navigate`** to a YouTube search URL in an **earlier** `<<<EXECUTION` block, then emit the `html-card` in a **later** block using ids visible in the refreshed Browser JSON — or use **`research-card`** with `citations` (real `https://www.youtube.com/watch?v=…` links) and no fake iframes.",
    "5b. **Repairing a bad html-card:** If the user asks to fix videos / embeds (or execution failed validation), do **not** only apologize — run **`browser.navigate`** to a YouTube (or Google video) search URL, read **video ids / watch URLs** from the Browser context JSON, then **`widget.update`** the **existing** `html-card` using its real **`id`** from Runtime **`widgets`** (same `kind`) and a full new `payload` (`html`, optional `plain`). Order: navigate block **first**, update block **second** in the same reply when possible. Alternative: **`widget.delete`** that `widgetId` then **`widget.create`** a fresh `html-card` — use if update is awkward.",
    "6. **Embeds:** Prefer `https://www.youtube.com/embed/…` or `youtube-nocookie.com`; `<script>` is stripped in the client.",
  ].join("\n");
}
