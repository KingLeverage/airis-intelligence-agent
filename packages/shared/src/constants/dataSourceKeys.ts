/**
 * Allowlisted adapter keys the server can resolve (no secrets in widget JSON).
 * Add new keys only with a matching server-side handler.
 */
export const WELL_KNOWN_DATA_SOURCE_KEYS = [
  "airis.demo.ticker",
  "airis.demo.chart",
  "airis.demo.news",
  "airis.demo.metrics",
] as const;

export type WellKnownDataSourceKey = (typeof WELL_KNOWN_DATA_SOURCE_KEYS)[number];
