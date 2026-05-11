import { useEffect, useMemo, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { WELL_KNOWN_DATA_SOURCE_KEYS } from "@airis/shared";
import { useWidgetsStore } from "../../../stores/widgets-store";

const THEME_VARIANTS = ["glass", "midnight", "contrast"] as const;
type ThemeVariant = (typeof THEME_VARIANTS)[number];

function parseThemeVariant(raw: string): ThemeVariant {
  return THEME_VARIANTS.includes(raw as ThemeVariant) ? (raw as ThemeVariant) : "glass";
}

export function WidgetSettingsPanel({
  record,
  open,
  onClose,
}: {
  record: WidgetRecord;
  open: boolean;
  onClose: () => void;
}) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const [title, setTitle] = useState(record.title);
  const [sourceKey, setSourceKey] = useState(record.dataSource?.key ?? "");
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(
    String(record.dataSource?.refreshIntervalMs ?? ""),
  );
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(
    typeof record.renderConfig?.themeVariant === "string"
      ? parseThemeVariant(record.renderConfig.themeVariant)
      : "glass",
  );
  const [configJson, setConfigJson] = useState(() => JSON.stringify(record.data, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(record.title);
    setSourceKey(record.dataSource?.key ?? "");
    setRefreshIntervalMs(String(record.dataSource?.refreshIntervalMs ?? ""));
    setThemeVariant(
      typeof record.renderConfig?.themeVariant === "string"
        ? parseThemeVariant(record.renderConfig.themeVariant)
        : "glass",
    );
    setConfigJson(JSON.stringify(record.data, null, 2));
    setError(null);
  }, [record]);

  const canSave = useMemo(() => {
    try {
      JSON.parse(configJson);
      return true;
    } catch {
      return false;
    }
  }, [configJson]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-2 top-10 z-20 rounded-lg border border-slate-700/80 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold uppercase tracking-wide text-slate-300">Widget settings</div>
        <button className="rounded px-2 py-1 text-slate-500 hover:bg-slate-800" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-slate-500">Title</span>
          <input
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-slate-500">Style</span>
            <select
              className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100"
              value={themeVariant}
              onChange={(e) => setThemeVariant(parseThemeVariant(e.target.value))}
            >
              <option value="glass">glass</option>
              <option value="midnight">midnight</option>
              <option value="contrast">contrast</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-slate-500">Refresh ms</span>
            <input
              className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100"
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(e.target.value)}
              placeholder="60000"
            />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-slate-500">Data source key</span>
          <select
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100"
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
          >
            <option value="">none</option>
            {WELL_KNOWN_DATA_SOURCE_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-slate-500">Config JSON</span>
          <textarea
            className="min-h-28 rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
          />
        </label>
        {!canSave || error ? <p className="text-amber-300">{error ?? "Config JSON is invalid"}</p> : null}
        <button
          className="rounded bg-cyan-600 px-3 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
          type="button"
          disabled={!canSave}
          onClick={() => {
            try {
              const data = JSON.parse(configJson) as Record<string, unknown>;
              const interval = Number(refreshIntervalMs);
              void patchWidgetRecord(record.id, {
                title,
                data,
                renderConfig: { ...(record.renderConfig ?? {}), themeVariant },
                dataSource: sourceKey
                  ? {
                      key: sourceKey,
                      ...(Number.isFinite(interval) && interval > 0
                        ? { refreshIntervalMs: Math.round(interval) }
                        : {}),
                    }
                  : null,
              }).then(onClose);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Save settings
        </button>
      </div>
    </div>
  );
}
