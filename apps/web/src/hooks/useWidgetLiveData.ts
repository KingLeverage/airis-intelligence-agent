import { useEffect, useMemo, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { api } from "../lib/api";
import { useWidgetsStore } from "../stores/widgets-store";

const DEFAULT_POLL_MS = 60_000;

/**
 * Merges allowlisted server `dataPatch` into `record.data` for display.
 * Secrets never live in widget files — only `dataSource.key` references server adapters.
 */
export function useWidgetLiveData(record: WidgetRecord): {
  merged: WidgetRecord;
  liveWarning: string | null;
} {
  const spaceId = useWidgetsStore((s) => s.spaceId);
  const key = record.dataSource?.key?.trim();
  const intervalMs = record.dataSource?.refreshIntervalMs ?? DEFAULT_POLL_MS;

  const [patch, setPatch] = useState<Record<string, unknown>>({});
  const [liveWarning, setLiveWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId || !key) {
      setPatch({});
      setLiveWarning(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.getWidgetLiveData(spaceId, record.id);
        if (cancelled) return;
        setPatch(res.dataPatch ?? {});
        setLiveWarning(res.warning ?? null);
      } catch {
        if (!cancelled) setLiveWarning("Live data request failed");
      }
    };

    void run();
    const t = window.setInterval(run, Math.max(5_000, intervalMs));
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [spaceId, record.id, key, intervalMs]);

  const merged = useMemo(
    () => ({
      ...record,
      data: { ...record.data, ...patch },
    }),
    [record, patch],
  );

  return { merged, liveWarning };
}
