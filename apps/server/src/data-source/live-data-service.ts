import type { WidgetKind, WidgetRecord } from "@airis/shared";
import { WELL_KNOWN_DATA_SOURCE_KEYS } from "@airis/shared";

const KEY_SET = new Set<string>(WELL_KNOWN_DATA_SOURCE_KEYS);

function isWellKnownKey(key: string): boolean {
  return KEY_SET.has(key);
}

function jitter(n: number, seed: number): number {
  const wave = Math.sin(seed * 0.001 + Date.now() * 0.0001) * 0.5;
  return Math.round((n + wave) * 100) / 100;
}

/**
 * Returns a shallow patch for `widget.data` from a allowlisted `dataSource.key`.
 * No network I/O — safe for demos. HTTP-backed adapters can be added with env-based URLs later.
 */
export function resolveWidgetLiveDataPatch(
  widget: WidgetRecord,
): { dataPatch: Record<string, unknown>; sourceKey?: string; warning?: string } {
  const key = widget.dataSource?.key?.trim();
  if (!key) {
    return { dataPatch: {} };
  }
  if (!isWellKnownKey(key)) {
    return {
      dataPatch: {},
      warning: `Unknown dataSource.key "${key}" (not in server allowlist)`,
    };
  }

  const asOf = new Date().toISOString();
  const seed = widget.id.charCodeAt(0) + asOf.length;

  switch (key) {
    case "airis.demo.ticker": {
      if (widget.kind !== "stat-ticker") {
        return { dataPatch: {}, warning: `Key ${key} is for stat-ticker`, sourceKey: key };
      }
      const symbols = [
        { symbol: "BTC", price: "98,4" + (Math.floor(seed % 10) + 1), changePct: jitter(0.35, seed) },
        { symbol: "ETH", price: "3,41" + (Math.floor(seed % 7) + 1), changePct: jitter(-0.12, seed + 1) },
        { symbol: "SOL", price: "17" + (Math.floor(seed % 5) + 1), changePct: jitter(0.8, seed + 2) },
      ];
      return { dataPatch: { symbols, subtitle: `Live demo · ${asOf.slice(11, 19)} UTC` }, sourceKey: key };
    }
    case "airis.demo.chart": {
      if (widget.kind !== "chart-panel") {
        return { dataPatch: {}, warning: `Key ${key} is for chart-panel`, sourceKey: key };
      }
      const series = [
        {
          id: "a",
          label: "Series A",
          points: [
            { x: "1", y: jitter(40, seed) },
            { x: "2", y: jitter(42, seed + 1) },
            { x: "3", y: jitter(41, seed + 2) },
            { x: "4", y: jitter(44, seed + 3) },
          ],
        },
      ];
      return { dataPatch: { series, chartType: "line" as const }, sourceKey: key };
    }
    case "airis.demo.news": {
      if (widget.kind !== "news-feed") {
        return { dataPatch: {}, warning: `Key ${key} is for news-feed`, sourceKey: key };
      }
      return {
        dataPatch: {
          items: [
            {
              id: `demo-${Date.now()}`,
              title: `Demo headline refresh (${asOf.slice(11, 19)})`,
              source: "AIRIS demo adapter",
              publishedAt: asOf,
              summary: "This item is injected by the live-data service for allowlisted keys.",
            },
          ],
        },
        sourceKey: key,
      };
    }
    case "airis.demo.metrics": {
      if (widget.kind !== "metric-grid") {
        return { dataPatch: {}, warning: `Key ${key} is for metric-grid`, sourceKey: key };
      }
      return {
        dataPatch: {
          metrics: [
            { id: "m1", label: "ARR", value: "$" + (1.1 + (seed % 10) / 10).toFixed(1) + "M", trend: "up" as const },
            { id: "m2", label: "NRR", value: (110 + (seed % 5)) + "%", trend: "flat" as const },
            { id: "m3", label: "Burn", value: "$" + (80 + (seed % 20)) + "k", trend: "down" as const },
            { id: "m4", label: "Runway", value: (18 + (seed % 8)) + " mo", trend: "flat" as const },
          ],
        },
        sourceKey: key,
      };
    }
    default:
      return { dataPatch: {}, warning: `Unhandled key ${key}` };
  }
}

export function describeDataSourceKeysForKind(kind: WidgetKind): string[] {
  const map: Partial<Record<WidgetKind, string[]>> = {
    "stat-ticker": ["airis.demo.ticker"],
    "chart-panel": ["airis.demo.chart"],
    "news-feed": ["airis.demo.news"],
    "metric-grid": ["airis.demo.metrics"],
  };
  return map[kind] ?? [];
}
