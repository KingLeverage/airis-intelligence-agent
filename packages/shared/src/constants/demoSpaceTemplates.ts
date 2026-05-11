import type { DashboardRecipe } from "../layout/dashboard-recipes.js";

/** Visual hint for the Start Fast panel (left accent / icon tone). */
export type DemoSpaceAccent = "iris" | "gold" | "violet" | "mint" | "coral" | "sky";

/** Icon id rendered on the web client (`DemoSpaceGlyph`). */
export type DemoSpaceIconId =
  | "news"
  | "crypto"
  | "research"
  | "tasks"
  | "content"
  | "sales";

export type DemoSpaceTemplate = {
  templateId: string;
  name: string;
  description?: string;
  recipe: DashboardRecipe;
  icon: DemoSpaceIconId;
  accent: DemoSpaceAccent;
  /** Shown on Home Start fast; only Crypto + Research today. */
  flagship?: boolean;
  /**
   * Static artwork for Home featured tiles (`apps/web/public/…`), e.g. `/demo-previews/demo-ai-news.svg`.
   */
  homePreviewPath?: string;
  /**
   * Bump when canonical title/description change; server syncs demo `demoDescription` (not widgets)
   * for spaces with lower `demoContentRevision`.
   */
  contentRevision: number;
};

/** Canonical demo workspaces seeded on first `GET /api/spaces` (idempotent). */
export const DEMO_SPACE_TEMPLATES: DemoSpaceTemplate[] = [
  {
    templateId: "demo-ai-news",
    name: "AI News Board",
    description: "A live workspace for AI headlines, summaries, and source tracking.",
    recipe: "ai-news-workspace",
    icon: "news",
    accent: "iris",
    homePreviewPath: "/demo-previews/demo-ai-news.svg",
    contentRevision: 2,
  },
  {
    templateId: "demo-crypto",
    name: "Crypto Dashboard",
    description:
      "Flagship markets board: multi-asset tape, dominance & sentiment snapshot, dual charts, and a curated headline column — built to show how AIRIS composes serious operator views.",
    recipe: "crypto-dashboard",
    icon: "crypto",
    accent: "gold",
    flagship: true,
    homePreviewPath: "/demo-previews/demo-crypto.svg",
    contentRevision: 4,
  },
  {
    templateId: "demo-research",
    name: "Research Workspace",
    description:
      "Flagship research surface: intel stream, executive brief with citations, next checks, and scenario lens — the template for evidence-heavy agent-assisted work.",
    recipe: "research-briefing",
    icon: "research",
    accent: "violet",
    flagship: true,
    homePreviewPath: "/demo-previews/demo-research.svg",
    contentRevision: 4,
  },
  {
    templateId: "demo-pet-wellness",
    name: "Pet wellness · allergens",
    description:
      "Chart-intelligence flagship: KPI strip, symptom mix donut, findings card, routine comparison, and evidence checklist — tuned for dander / allergy research vignettes.",
    recipe: "pet-allergy-research-hub",
    icon: "research",
    accent: "mint",
    flagship: true,
    homePreviewPath: "/demo-previews/demo-pet-wellness.svg",
    contentRevision: 1,
  },
  {
    templateId: "demo-risk-heatmap",
    name: "Risk heatmap lab",
    description:
      "KPI strip + normalized risk matrix (`heatmap-panel`) + synthesis card — for two-dimensional exposure or control-gap storytelling.",
    recipe: "risk-heatmap-board",
    icon: "research",
    accent: "coral",
    homePreviewPath: "/demo-previews/demo-risk-heatmap.svg",
    contentRevision: 1,
  },
  {
    templateId: "demo-task",
    name: "Task Command Center",
    description: "A productivity space for checklists, planning, and priorities.",
    recipe: "startup-kpi-board",
    icon: "tasks",
    accent: "mint",
    homePreviewPath: "/demo-previews/demo-task.svg",
    contentRevision: 2,
  },
  {
    templateId: "demo-content",
    name: "Content Planner",
    description: "A workspace for ideas, publishing flows, and content drafts.",
    recipe: "ticker-two-column",
    icon: "content",
    accent: "coral",
    homePreviewPath: "/demo-previews/demo-content.svg",
    contentRevision: 2,
  },
  {
    templateId: "demo-sales",
    name: "Sales KPI Board",
    description: "A metrics-oriented workspace for pipeline, activity, and goals.",
    recipe: "sales-kpi-board",
    icon: "sales",
    accent: "sky",
    homePreviewPath: "/demo-previews/demo-sales.svg",
    contentRevision: 2,
  },
];

/** Template ids eligible for flagship widget recipe re-apply (Crypto + Research). */
export const FLAGSHIP_DEMO_TEMPLATE_IDS: string[] = DEMO_SPACE_TEMPLATES.filter((t) => t.flagship).map(
  (t) => t.templateId,
);
