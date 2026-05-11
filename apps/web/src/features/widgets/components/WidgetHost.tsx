import { useCallback, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { useWidgetLiveData } from "../../../hooks/useWidgetLiveData";
import { useWidgetsStore } from "../../../stores/widgets-store";
import { WidgetRenderer } from "../registry";
import { WidgetFrame } from "./WidgetFrame";
import { WidgetSettingsPanel } from "./WidgetSettingsPanel";

export function WidgetHost({ record }: { record: WidgetRecord }) {
  const { merged, liveWarning } = useWidgetLiveData(record);
  const isTicker = record.kind === "stat-ticker";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteWidget = useWidgetsStore((s) => s.deleteWidget);

  const onDelete = useCallback(async () => {
    if (
      !window.confirm(
        `Remove widget “${record.title}” (${record.kind}) from this workspace? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteWidget(record.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }, [deleteWidget, record.id, record.kind, record.title]);

  return (
    <div className="relative h-full">
      <WidgetFrame
        title={record.title}
        kind={record.kind}
        widgetId={record.id}
        compactHeader={isTicker}
        liveWarning={liveWarning}
        actions={
          <>
            <button
              type="button"
              className="rounded border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-slate-600 hover:text-slate-300"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={deleting}
              className="rounded border border-rose-900/60 px-1.5 py-0.5 text-[10px] text-rose-300/90 hover:border-rose-700 hover:bg-rose-950/40 disabled:opacity-50"
              onClick={() => void onDelete()}
            >
              {deleting ? "…" : "Delete"}
            </button>
          </>
        }
      >
        <WidgetRenderer record={merged} />
      </WidgetFrame>
      <WidgetSettingsPanel
        record={record}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
