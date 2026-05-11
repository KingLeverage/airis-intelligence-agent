import { z } from "zod";
import type { WidgetDataSourceConfig } from "../schemas/widget.js";
import type { WidgetKind } from "../schemas/widget.js";
import type { WidgetLayoutPosition } from "../schemas/widget.js";
import { defaultLayoutForKind } from "./widget-layout-defaults.js";

function rid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16)}`;
}

export const DASHBOARD_RECIPE_IDS = [
  "crypto-dashboard",
  "ai-news-workspace",
  "startup-kpi-board",
  "sales-kpi-board",
  "research-briefing",
  "ticker-two-column",
  "donut-distribution-board",
  "grouped-bar-insight",
  "stacked-trend-kpi",
  "ranked-bars-dashboard",
  "dual-chart-composition",
  "pet-allergy-research-hub",
  "evidence-comparison-row",
  "findings-metrics-news",
  "metric-strip-line-focus",
  "research-timeline-intel",
  "risk-heatmap-board",
  "milestone-timeline-board",
  /** KPI strip + narrative + geographic-style heatmap — agent should customize cells from research. */
  "geo-heatmap-brief",
] as const;

export const DashboardRecipeSchema = z.enum(DASHBOARD_RECIPE_IDS);

export type DashboardRecipe = z.infer<typeof DashboardRecipeSchema>;

export type RecipeWidgetBlueprint = {
  kind: WidgetKind;
  title: string;
  layout: WidgetLayoutPosition;
  payload: Record<string, unknown>;
  dataSource?: WidgetDataSourceConfig;
};

/** Expands a named recipe into widget specs (payloads validate per-kind on the server). */
export function expandDashboardRecipe(recipe: DashboardRecipe): RecipeWidgetBlueprint[] {
  switch (recipe) {
    case "crypto-dashboard":
      return [
        {
          kind: "stat-ticker",
          title: "Live tape",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            subtitle: "Spot majors · flagship sample stream",
            symbols: [
              { symbol: "BTC", price: "64.18k", changePct: 0.42, hint: "Vol $28B" },
              { symbol: "ETH", price: "3.42k", changePct: -0.18, hint: "L2 net +" },
              { symbol: "SOL", price: "142.06", changePct: 1.08, hint: "Perp OI ↑" },
              { symbol: "AVAX", price: "36.82", changePct: -0.55, hint: "Subnet TVL" },
              { symbol: "LINK", price: "18.41", changePct: 0.91, hint: "Staking" },
            ],
            trendMode: "up",
          },
        },
        {
          kind: "metric-grid",
          title: "Market posture",
          layout: { x: 0, y: 2, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "BTC dominance", value: "54.1%", trend: "flat", delta: "24h" },
              { id: rid(), label: "ETH dominance", value: "17.2%", trend: "up" },
              { id: rid(), label: "Perp funding", value: "+0.012%", trend: "flat", delta: "8h avg" },
              { id: rid(), label: "Fear & greed", value: "62", trend: "up", delta: "Greed" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "BTC vs ETH — indexed rebased",
          layout: { x: 0, y: 4, w: 6, h: 5 },
          payload: {
            chartType: "area",
            comparisonMode: true,
            yLabel: "Indexed (base = 100)",
            series: [
              {
                id: "a",
                label: "BTC",
                color: "rgba(246, 207, 122, 0.9)",
                points: [
                  { x: "Mon", y: 100 },
                  { x: "Tue", y: 102.1 },
                  { x: "Wed", y: 100.8 },
                  { x: "Thu", y: 105.4 },
                  { x: "Fri", y: 104.2 },
                ],
              },
              {
                id: "b",
                label: "ETH",
                color: "rgba(134, 183, 255, 0.95)",
                points: [
                  { x: "Mon", y: 100 },
                  { x: "Tue", y: 101.2 },
                  { x: "Wed", y: 99.4 },
                  { x: "Thu", y: 103.8 },
                  { x: "Fri", y: 106.1 },
                ],
              },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Alts — 5d return %",
          layout: { x: 6, y: 4, w: 6, h: 5 },
          payload: {
            chartType: "bar",
            yLabel: "Return %",
            series: [
              {
                id: "alts",
                label: "5d",
                points: [
                  { x: "SOL", y: 4.2 },
                  { x: "AVAX", y: -1.1 },
                  { x: "LINK", y: 2.8 },
                  { x: "ARB", y: 0.4 },
                  { x: "OP", y: 1.9 },
                  { x: "TIA", y: 3.1 },
                ],
              },
            ],
          },
        },
        {
          kind: "news-feed",
          title: "Desk & flows",
          layout: { x: 0, y: 9, w: 12, h: 5 },
          payload: {
            category: "crypto",
            maxItems: 8,
            showTimestamps: true,
            source: "Curated seed · replace with live keys",
            items: [
              {
                id: rid(),
                title: "ETF flows flip positive as GBTC discount narrows",
                source: "Flows desk",
                summary: "Wire `airis.demo.news` or ask the agent to attach a live headline source.",
                publishedAt: new Date().toISOString(),
              },
              {
                id: rid(),
                title: "L2 median fee down 18% week-on-week",
                source: "Network",
                summary: "Pair chart panels with browser research for protocol-specific context.",
              },
              {
                id: rid(),
                title: "Stablecoin aggregate flat — risk-on tone intact",
                source: "On-chain",
                summary: "Use snapshots before sharing this board externally.",
              },
              {
                id: rid(),
                title: "Hill hearing: market-structure bill markup scheduled",
                source: "Policy",
                summary: "Pin the PDF in chat; keep the seed as your template on Home.",
              },
              {
                id: rid(),
                title: "Options skew: short-dated calls bid in BTC",
                source: "Derivatives",
                summary: "Demonstrates multi-panel operator layout in AIRIS.",
              },
            ],
          },
        },
      ];
    case "ai-news-workspace":
      return [
        {
          kind: "news-feed",
          title: "AI headlines",
          layout: { x: 0, y: 0, w: 8, h: 6 },
          payload: {
            category: "ai",
            maxItems: 8,
            items: [
              {
                id: rid(),
                title: "Sample headline — agent will replace with real items",
                source: "Feed",
                publishedAt: new Date().toISOString(),
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Research notes",
          layout: { x: 8, y: 0, w: 4, h: 6 },
          payload: {
            summary: "Key takeaways appear here.",
            bullets: ["Point one", "Point two"],
            tags: ["AI", "workspace"],
          },
        },
      ];
    case "startup-kpi-board":
      return [
        {
          kind: "metric-grid",
          title: "KPIs",
          layout: { x: 0, y: 0, w: 12, h: 3 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "ARR", value: "—", trend: "flat" },
              { id: rid(), label: "NRR", value: "—", trend: "flat" },
              { id: rid(), label: "Burn", value: "—", trend: "flat" },
              { id: rid(), label: "Runway", value: "—", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Revenue trend",
          layout: { x: 0, y: 3, w: 8, h: 5 },
          payload: {
            chartType: "area",
            series: [
              {
                id: "rev",
                label: "Revenue",
                points: [
                  { x: "Q1", y: 10 },
                  { x: "Q2", y: 14 },
                  { x: "Q3", y: 18 },
                ],
              },
            ],
          },
        },
        {
          kind: "comparison-panel",
          title: "Plan vs actual",
          layout: { x: 8, y: 3, w: 4, h: 5 },
          payload: {
            highlightDiff: true,
            entities: [
              {
                id: "a",
                label: "Plan",
                metrics: [
                  { key: "Rev", value: "100" },
                  { key: "Cost", value: "40" },
                ],
              },
              {
                id: "b",
                label: "Actual",
                metrics: [
                  { key: "Rev", value: "96" },
                  { key: "Cost", value: "42" },
                ],
              },
            ],
          },
        },
      ];
    case "sales-kpi-board": {
      const rows = expandDashboardRecipe("startup-kpi-board");
      return rows.map((r, i) => {
        if (i === 0) return { ...r, title: "Sales KPIs" };
        if (i === 1) return { ...r, title: "Pipeline trend" };
        return { ...r, title: "Territory vs plan" };
      });
    }
    case "research-briefing":
      return [
        {
          kind: "metric-grid",
          title: "Evidence session",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Sources skimmed", value: "12", trend: "flat", delta: "session" },
              { id: rid(), label: "Open threads", value: "4", trend: "up", delta: "prioritize" },
              { id: rid(), label: "Synthesis confidence", value: "Med", trend: "flat" },
              { id: rid(), label: "Next review", value: "Today", trend: "flat" },
            ],
          },
        },
        {
          kind: "news-feed",
          title: "Intel stream · sources",
          layout: { x: 0, y: 2, w: 8, h: 8 },
          payload: {
            category: "research",
            maxItems: 8,
            showTimestamps: true,
            source: "Seeded items · replace via agent or adapters",
            items: [
              {
                id: rid(),
                title: "Preprint claims 14% lift — underpowered n, wide CI",
                source: "arXiv · ML",
                publishedAt: new Date().toISOString(),
                summary: "Have the agent extract methods + sample size before you cite it.",
              },
              {
                id: rid(),
                title: "Vendor edge box: latency vs. cloud baselines (tables 3–4)",
                source: "Vendor blog",
                summary: "Paste numbers into a comparison panel row when you validate.",
              },
              {
                id: rid(),
                title: "Dataset v3 license — commercial use requires attribution line",
                source: "Registry",
                summary: "Citations in the brief card keep legal visible to reviewers.",
              },
              {
                id: rid(),
                title: "Draft rule: audit logs for agent-assisted eligibility decisions",
                source: "Policy PDF",
                summary: "Link the PDF from chat; snapshot before external share.",
              },
              {
                id: rid(),
                title: "Replication note: baseline mismatch vs. our internal run",
                source: "Internal",
                summary: "Shows how AIRIS holds sources, checks, and scenario lens together.",
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Executive brief · flagship",
          layout: { x: 8, y: 2, w: 4, h: 4 },
          payload: {
            summary:
              "Three threads are decision-ready; two need primary pulls or a fresh agent pass on methodology. This layout is the default stakeholder readout surface in AIRIS research mode.",
            bullets: [
              "Directional effect — demand power analysis before spend.",
              "Vendor benchmark omits cold-start; mark as provisional.",
              "EU policy rider may gate rollout — confirm with counsel.",
              "Replication gap vs. our baseline — schedule one follow-up experiment.",
            ],
            tags: ["flagship", "Q2", "evidence", "risk"],
            citations: [
              { label: "Methods supplement (PDF)", url: "https://example.com/paper-methods" },
              { label: "License changelog", url: "https://example.com/dataset-license" },
              { label: "Internal baseline run", url: "https://example.com/baseline" },
            ],
          },
        },
        {
          kind: "checklist",
          title: "Source checks",
          layout: { x: 8, y: 6, w: 4, h: 4 },
          payload: {
            items: [
              { id: rid(), label: "Extract table A.3 raw n from appendix", done: false },
              { id: rid(), label: "Email author: excluded cohort definition", done: false },
              { id: rid(), label: "Re-run benchmark with our hardware profile", done: true },
              { id: rid(), label: "Ethics disclosure if human ratings used", done: false },
            ],
          },
        },
        {
          kind: "comparison-panel",
          title: "Strategic lens",
          layout: { x: 0, y: 10, w: 12, h: 4 },
          payload: {
            highlightDiff: true,
            entities: [
              {
                id: "bull",
                label: "Accelerate proof",
                metrics: [
                  { key: "Upside", value: "High" },
                  { key: "Spend", value: "Med" },
                  { key: "Reversibility", value: "Low" },
                ],
              },
              {
                id: "bear",
                label: "Constrain scope",
                metrics: [
                  { key: "Upside", value: "Capped" },
                  { key: "Spend", value: "Low" },
                  { key: "Reversibility", value: "High" },
                ],
              },
            ],
          },
        },
      ];
    case "ticker-two-column":
      return [
        {
          kind: "stat-ticker",
          title: "Tape",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            symbols: [
              { symbol: "A", price: "—" },
              { symbol: "B", price: "—" },
            ],
            trendMode: "neutral",
          },
        },
        {
          kind: "chart-panel",
          title: "Chart",
          layout: { x: 0, y: 2, w: 6, h: 5 },
          payload: {
            chartType: "line",
            series: [
              {
                id: "s",
                label: "Series",
                points: [
                  { x: "1", y: 1 },
                  { x: "2", y: 3 },
                ],
              },
            ],
          },
        },
        {
          kind: "news-feed",
          title: "News",
          layout: { x: 6, y: 2, w: 6, h: 5 },
          payload: { items: [], maxItems: 5 },
        },
      ];
    case "donut-distribution-board":
      return [
        {
          kind: "metric-grid",
          title: "KPI strip",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Total", value: "100%", trend: "flat" },
              { id: rid(), label: "Top slice", value: "—", trend: "up" },
              { id: rid(), label: "Segments", value: "4", trend: "flat" },
              { id: rid(), label: "Confidence", value: "Med", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Category mix",
          layout: { x: 0, y: 2, w: 12, h: 6 },
          payload: {
            chartType: "pie",
            subtitle: "Part-to-whole breakdown — replace labels and values.",
            series: [
              {
                id: "mix",
                label: "Share",
                points: [
                  { x: "North", y: 38 },
                  { x: "South", y: 27 },
                  { x: "East", y: 22 },
                  { x: "West", y: 13 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Reading guide",
          layout: { x: 0, y: 8, w: 12, h: 3 },
          payload: {
            summary:
              "Use this recipe when the user asks for a donut / share view. Keep ≤7 slices for legibility.",
            bullets: ["Rename slices to your domain", "Add metric strip for totals or sample size"],
            tags: ["recipe", "donut-distribution-board"],
          },
        },
      ];
    case "grouped-bar-insight":
      return [
        {
          kind: "metric-grid",
          title: "Comparison context",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Series A", value: "—", trend: "flat" },
              { id: rid(), label: "Series B", value: "—", trend: "flat" },
              { id: rid(), label: "Δ", value: "—", trend: "flat" },
              { id: rid(), label: "Units", value: "—", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Grouped comparison",
          layout: { x: 0, y: 2, w: 12, h: 6 },
          payload: {
            chartType: "bar",
            subtitle: "Same categories across series — replace with your labels.",
            comparisonMode: true,
            yLabel: "Value",
            series: [
              {
                id: "a",
                label: "Scenario A",
                points: [
                  { x: "Q1", y: 40 },
                  { x: "Q2", y: 52 },
                  { x: "Q3", y: 48 },
                ],
              },
              {
                id: "b",
                label: "Scenario B",
                points: [
                  { x: "Q1", y: 32 },
                  { x: "Q2", y: 44 },
                  { x: "Q3", y: 55 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Interpretation",
          layout: { x: 0, y: 8, w: 12, h: 3 },
          payload: {
            summary: "Call out divergence by category; cite sources in bullets when available.",
            bullets: ["Normalize units before comparing", "Note seasonality if quarters are synthetic"],
            tags: ["recipe", "grouped-bar-insight"],
          },
        },
      ];
    case "stacked-trend-kpi":
      return [
        {
          kind: "metric-grid",
          title: "Trajectory KPIs",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Latest", value: "—", trend: "up" },
              { id: rid(), label: "Prior", value: "—", trend: "flat" },
              { id: rid(), label: "Volatility", value: "—", trend: "flat" },
              { id: rid(), label: "Horizon", value: "8w", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Stacked trend",
          layout: { x: 0, y: 2, w: 12, h: 6 },
          payload: {
            chartType: "area",
            subtitle: "Composition or level over time — align x keys across series.",
            comparisonMode: true,
            yLabel: "Index",
            series: [
              {
                id: "s1",
                label: "Component A",
                points: [
                  { x: "W1", y: 12 },
                  { x: "W2", y: 14 },
                  { x: "W3", y: 13 },
                  { x: "W4", y: 16 },
                ],
              },
              {
                id: "s2",
                label: "Component B",
                points: [
                  { x: "W1", y: 8 },
                  { x: "W2", y: 9 },
                  { x: "W3", y: 11 },
                  { x: "W4", y: 10 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Narrative",
          layout: { x: 0, y: 8, w: 12, h: 3 },
          payload: {
            summary: "Explain drivers of inflection points on the trend.",
            tags: ["recipe", "stacked-trend-kpi"],
          },
        },
      ];
    case "ranked-bars-dashboard":
      return [
        {
          kind: "chart-panel",
          title: "Ranked comparison",
          layout: { x: 0, y: 0, w: 8, h: 7 },
          payload: {
            chartType: "bar",
            subtitle: "Sort bars by descending y for leaderboard reads.",
            yLabel: "Score",
            series: [
              {
                id: "rank",
                label: "Score",
                points: [
                  { x: "Team A", y: 92 },
                  { x: "Team B", y: 86 },
                  { x: "Team C", y: 74 },
                  { x: "Team D", y: 63 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Ranking notes",
          layout: { x: 8, y: 0, w: 4, h: 7 },
          payload: {
            summary: "State methodology for ranking (what the score encodes).",
            bullets: ["Tie-break rules", "Data vintage"],
            tags: ["recipe", "ranked-bars-dashboard"],
          },
        },
      ];
    case "dual-chart-composition":
      return [
        {
          kind: "metric-grid",
          title: "Dashboard KPIs",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "North star", value: "—", trend: "flat" },
              { id: rid(), label: "Guardrail", value: "—", trend: "flat" },
              { id: rid(), label: "Quality", value: "—", trend: "up" },
              { id: rid(), label: "Latency", value: "—", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Primary — mix",
          layout: { x: 0, y: 2, w: 6, h: 5 },
          payload: {
            chartType: "pie",
            subtitle: "Part-to-whole",
            series: [
              {
                id: "p",
                label: "Mix",
                points: [
                  { x: "A", y: 45 },
                  { x: "B", y: 35 },
                  { x: "C", y: 20 },
                ],
              },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Secondary — trend",
          layout: { x: 6, y: 2, w: 6, h: 5 },
          payload: {
            chartType: "line",
            subtitle: "Supporting trajectory",
            yLabel: "Level",
            series: [
              {
                id: "t",
                label: "Signal",
                points: [
                  { x: "T1", y: 10 },
                  { x: "T2", y: 12 },
                  { x: "T3", y: 11 },
                  { x: "T4", y: 15 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Composition read",
          layout: { x: 0, y: 7, w: 12, h: 4 },
          payload: {
            summary: "Tie the donut to the line: what mix shift explains the trend?",
            tags: ["recipe", "dual-chart-composition"],
          },
        },
      ];
    case "pet-allergy-research-hub":
      return [
        {
          kind: "metric-grid",
          title: "Environmental snapshot",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Dander load", value: "Med", trend: "up", delta: "vs last week" },
              { id: rid(), label: "HEPA runtime", value: "18h", trend: "flat" },
              { id: rid(), label: "Symptom days", value: "3", trend: "down", delta: "7d window" },
              { id: rid(), label: "Meds on hand", value: "Yes", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Symptom mix (example)",
          layout: { x: 0, y: 2, w: 6, h: 6 },
          payload: {
            chartType: "pie",
            subtitle: "Replace with clinician-tuned categories",
            series: [
              {
                id: "sx",
                label: "Share",
                points: [
                  { x: "Nasal", y: 44 },
                  { x: "Skin", y: 28 },
                  { x: "Ocular", y: 18 },
                  { x: "Other", y: 10 },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Findings · dander & pets",
          layout: { x: 6, y: 2, w: 6, h: 4 },
          payload: {
            summary:
              "Template for pet-allergy / dander research: HEPA cadence, coat grooming, and symptom diary correlation.",
            bullets: [
              "Verify triggers with a 2-week structured diary.",
              "Discuss antihistamine plan changes only with a clinician.",
              "Note seasonal pollen overlap when interpreting flare-ups.",
            ],
            tags: ["pet", "allergy", "dander", "flagship"],
          },
        },
        {
          kind: "comparison-panel",
          title: "Low-allergen routine vs typical",
          layout: { x: 6, y: 6, w: 6, h: 4 },
          payload: {
            highlightDiff: true,
            entities: [
              {
                id: "low",
                label: "Low-allergen routine",
                metrics: [
                  { key: "Vacuum", value: "2×/wk + HEPA" },
                  { key: "Pet zone", value: "Limited bedroom" },
                  { key: "Grooming", value: "Weekly" },
                ],
              },
              {
                id: "typ",
                label: "Typical home",
                metrics: [
                  { key: "Vacuum", value: "Ad hoc" },
                  { key: "Pet zone", value: "Open" },
                  { key: "Grooming", value: "Occasional" },
                ],
              },
            ],
          },
        },
        {
          kind: "checklist",
          title: "Evidence checks",
          layout: { x: 0, y: 8, w: 6, h: 4 },
          payload: {
            items: [
              { id: rid(), label: "Confirm pet species-specific dander guidance", done: false },
              { id: rid(), label: "Attach vet letter PDF to chat for traceability", done: false },
              { id: rid(), label: "Cross-check OTC med interactions", done: false },
            ],
          },
        },
      ];
    case "evidence-comparison-row":
      return [
        {
          kind: "comparison-panel",
          title: "Hypothesis vs null",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          payload: {
            highlightDiff: true,
            entities: [
              {
                id: "h",
                label: "Hypothesis",
                metrics: [
                  { key: "Effect", value: "+8%" },
                  { key: "Power", value: "0.72" },
                ],
              },
              {
                id: "n",
                label: "Null / control",
                metrics: [
                  { key: "Effect", value: "+1%" },
                  { key: "Power", value: "0.55" },
                ],
              },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Evidence note",
          layout: { x: 6, y: 0, w: 6, h: 6 },
          payload: {
            summary: "Pair matrix numbers with prose on study design limits.",
            citations: [{ label: "Primary study (PDF)", url: "https://example.com/study" }],
            tags: ["evidence"],
          },
        },
        {
          kind: "news-feed",
          title: "Related intel",
          layout: { x: 0, y: 6, w: 12, h: 5 },
          payload: {
            maxItems: 6,
            showTimestamps: true,
            items: [
              {
                id: rid(),
                title: "Replication attempt posted — smaller n than original",
                source: "Preprint",
                publishedAt: new Date().toISOString(),
              },
            ],
          },
        },
      ];
    case "findings-metrics-news":
      return [
        {
          kind: "metric-grid",
          title: "Executive pulse",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Risk", value: "Med", trend: "flat" },
              { id: rid(), label: "Opportunity", value: "High", trend: "up" },
              { id: rid(), label: "Spend", value: "On plan", trend: "flat" },
              { id: rid(), label: "Next gate", value: "Fri", trend: "flat" },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Findings summary",
          layout: { x: 0, y: 2, w: 7, h: 7 },
          payload: {
            summary: "Three decisions unlocked; two require data pulls before commit.",
            bullets: ["Decision A ready", "Decision B blocked on vendor API", "Decision C legal review"],
            tags: ["exec", "brief"],
          },
        },
        {
          kind: "news-feed",
          title: "Market / policy stream",
          layout: { x: 7, y: 2, w: 5, h: 7 },
          payload: {
            maxItems: 6,
            items: [
              {
                id: rid(),
                title: "Regulator guidance draft — comment window opens Monday",
                source: "Wire",
                publishedAt: new Date().toISOString(),
              },
            ],
          },
        },
      ];
    case "metric-strip-line-focus":
      return [
        {
          kind: "metric-grid",
          title: "Metric strip",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "North star", value: "—", trend: "up" },
              { id: rid(), label: "Guardrail", value: "—", trend: "flat" },
              { id: rid(), label: "Drift", value: "Low", trend: "flat" },
              { id: rid(), label: "SLO", value: "99.2%", trend: "flat" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Primary trend",
          layout: { x: 0, y: 2, w: 12, h: 8 },
          payload: {
            chartType: "line",
            subtitle: "Hero chart — widen widget for readability.",
            comparisonMode: true,
            yLabel: "Signal",
            series: [
              {
                id: "live",
                label: "Live",
                points: [
                  { x: "d-6", y: 4 },
                  { x: "d-5", y: 5 },
                  { x: "d-4", y: 5 },
                  { x: "d-3", y: 7 },
                  { x: "d-2", y: 8 },
                  { x: "d-1", y: 9 },
                ],
              },
              {
                id: "baseline",
                label: "Baseline",
                points: [
                  { x: "d-6", y: 3 },
                  { x: "d-5", y: 3 },
                  { x: "d-4", y: 4 },
                  { x: "d-3", y: 4 },
                  { x: "d-2", y: 4 },
                  { x: "d-1", y: 4 },
                ],
              },
            ],
          },
        },
      ];
    case "research-timeline-intel":
      return [
        {
          kind: "checklist",
          title: "Reading queue",
          layout: { x: 0, y: 0, w: 4, h: 8 },
          payload: {
            items: [
              { id: rid(), label: "Pull methods table from appendix", done: false },
              { id: rid(), label: "Email author: excluded cohort", done: false },
              { id: rid(), label: "Archive snapshot before external share", done: true },
            ],
          },
        },
        {
          kind: "timeline-panel",
          title: "Milestone & intel stream",
          layout: { x: 4, y: 0, w: 8, h: 8 },
          payload: {
            subtitle: "Structured timeline — pair with checklist + sparkline below",
            events: [
              {
                id: rid(),
                at: "2026-04-18T14:00:00Z",
                title: "Vendor latency blog — tables 3–4 extracted",
                tone: "neutral",
                detail: "Saved to reference library with tags vendor,sla.",
              },
              {
                id: rid(),
                at: "2026-04-20T10:00:00Z",
                title: "Dataset v3 license updated — commercial clause",
                tone: "risk",
                detail: "Skim section 4 before you ship charts externally.",
              },
              {
                id: rid(),
                at: "2026-04-22T09:30:00Z",
                title: "External review window opens",
                tone: "milestone",
              },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Spark context",
          layout: { x: 0, y: 8, w: 12, h: 4 },
          payload: {
            chartType: "line",
            subtitle: "Optional supporting trend for the intel above",
            series: [
              {
                id: "sp",
                label: "Mentions / week",
                points: [
                  { x: "W1", y: 3 },
                  { x: "W2", y: 5 },
                  { x: "W3", y: 4 },
                  { x: "W4", y: 7 },
                ],
              },
            ],
          },
        },
      ];
    case "risk-heatmap-board":
      return [
        {
          kind: "metric-grid",
          title: "Guardrail KPIs",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Max cell", value: "0.92", trend: "up", delta: "vs last run" },
              { id: rid(), label: "Hot zones", value: "3", trend: "flat" },
              { id: rid(), label: "Coverage", value: "94%", trend: "up" },
              { id: rid(), label: "Drift index", value: "Low", trend: "flat" },
            ],
          },
        },
        {
          kind: "heatmap-panel",
          title: "Risk × dimension",
          layout: { x: 0, y: 2, w: 12, h: 7 },
          payload: {
            subtitle: "Normalized scores — deeper red = higher modeled risk",
            rowLabels: ["Infra", "Data", "People", "Vendor"],
            colLabels: ["Likelihood", "Impact", "Detectability", "Velocity"],
            colorScale: "airis",
            cells: [
              { r: 0, c: 0, v: 0.55 },
              { r: 0, c: 1, v: 0.72 },
              { r: 0, c: 2, v: 0.4 },
              { r: 0, c: 3, v: 0.61 },
              { r: 1, c: 0, v: 0.48 },
              { r: 1, c: 1, v: 0.88 },
              { r: 1, c: 2, v: 0.52 },
              { r: 1, c: 3, v: 0.45 },
              { r: 2, c: 0, v: 0.33 },
              { r: 2, c: 1, v: 0.5 },
              { r: 2, c: 2, v: 0.67 },
              { r: 2, c: 3, v: 0.39 },
              { r: 3, c: 0, v: 0.7 },
              { r: 3, c: 1, v: 0.63 },
              { r: 3, c: 2, v: 0.41 },
              { r: 3, c: 3, v: 0.76 },
            ],
          },
        },
        {
          kind: "research-card",
          title: "How to read this board",
          layout: { x: 0, y: 9, w: 12, h: 5 },
          payload: {
            summary:
              "Heatmaps compress many comparisons into one surface. Use KPIs above for thresholds; use this card for narrative and next actions.",
            bullets: [
              "Validate axis labels match the scoring rubric you used.",
              "If two cells tie, break ties with qualitative notes in citations.",
            ],
            tags: ["risk", "heatmap", "operator"],
          },
        },
      ];
    case "milestone-timeline-board":
      return [
        {
          kind: "metric-grid",
          title: "Delivery pulse",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "On track", value: "4/6", trend: "flat" },
              { id: rid(), label: "Slip risk", value: "Med", trend: "down" },
              { id: rid(), label: "Next gate", value: "May 12", trend: "neutral" },
              { id: rid(), label: "Burn", value: "62%", trend: "up" },
            ],
          },
        },
        {
          kind: "timeline-panel",
          title: "Milestones",
          layout: { x: 0, y: 2, w: 6, h: 9 },
          payload: {
            subtitle: "Program timeline — tones are semantic, not stock advice",
            events: [
              { id: rid(), at: "2026-04-01", title: "Design lock", tone: "milestone" },
              { id: rid(), at: "2026-04-18", title: "Integration freeze", tone: "neutral", detail: "Feature flags default off." },
              { id: rid(), at: "2026-05-02", title: "Load test gap", tone: "risk", detail: "Synthetic traffic still sub-target." },
              { id: rid(), at: "2026-05-12", title: "GA readiness review", tone: "win" },
            ],
          },
        },
        {
          kind: "chart-panel",
          title: "Burndown proxy",
          layout: { x: 6, y: 2, w: 6, h: 9 },
          payload: {
            chartType: "area",
            subtitle: "Work remaining index (illustrative)",
            yLabel: "Index",
            series: [
              {
                id: "rem",
                label: "Remaining",
                points: [
                  { x: "S1", y: 42 },
                  { x: "S2", y: 36 },
                  { x: "S3", y: 28 },
                  { x: "S4", y: 19 },
                  { x: "S5", y: 11 },
                ],
              },
            ],
          },
        },
      ];
    case "geo-heatmap-brief":
      return [
        {
          kind: "metric-grid",
          title: "Market pulse",
          layout: { x: 0, y: 0, w: 12, h: 2 },
          payload: {
            columns: 4,
            metrics: [
              { id: rid(), label: "Coverage", value: "Global", trend: "flat" },
              { id: rid(), label: "Primary region", value: "—", trend: "flat" },
              { id: rid(), label: "Confidence", value: "Med", trend: "flat" },
              { id: rid(), label: "Next check", value: "Validate cells", trend: "flat" },
            ],
          },
        },
        {
          kind: "research-card",
          title: "Executive synthesis",
          layout: { x: 0, y: 2, w: 12, h: 5 },
          payload: {
            summary:
              "Replace this card with your narrative: thesis, key numbers, and caveats. The heatmap below uses **rows = regions/markets** and **columns = metrics** — edit labels and `cells` so every value traces to your sources.",
            bullets: [
              "Rename `rowLabels` to match the geography in the brief (countries, metros, sales regions).",
              "Normalize `v` to 0–1 for color, or keep raw scores and tune copy in the subtitle.",
            ],
            tags: ["geography", "heatmap", "brief"],
          },
        },
        {
          kind: "heatmap-panel",
          title: "Regional matrix",
          layout: { x: 0, y: 7, w: 12, h: 8 },
          payload: {
            subtitle: "Template grid — swap labels and cell values from your research.",
            colorScale: "airis",
            rowLabels: ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"],
            colLabels: ["Share index", "YoY momentum", "Composite score"],
            cells: [
              { r: 0, c: 0, v: 0.62 },
              { r: 0, c: 1, v: 0.55 },
              { r: 0, c: 2, v: 0.58 },
              { r: 1, c: 0, v: 0.48 },
              { r: 1, c: 1, v: 0.52 },
              { r: 1, c: 2, v: 0.5 },
              { r: 2, c: 0, v: 0.71 },
              { r: 2, c: 1, v: 0.64 },
              { r: 2, c: 2, v: 0.68 },
              { r: 3, c: 0, v: 0.38 },
              { r: 3, c: 1, v: 0.44 },
              { r: 3, c: 2, v: 0.41 },
              { r: 4, c: 0, v: 0.33 },
              { r: 4, c: 1, v: 0.36 },
              { r: 4, c: 2, v: 0.35 },
            ],
          },
        },
      ];
    default: {
      const _exhaustive: never = recipe;
      return _exhaustive;
    }
  }
}

/** When a recipe is not used — per-kind default footprint. */
export function layoutFallbackForKind(kind: WidgetKind): WidgetLayoutPosition {
  return defaultLayoutForKind(kind);
}
