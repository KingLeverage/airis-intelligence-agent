import { useCallback, useEffect, useMemo, useRef } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useSpacesStore } from "../../stores/spaces-store";
import { useWidgetsStore } from "../../stores/widgets-store";
import { api } from "../../lib/api";
import { WidgetHost } from "../widgets/components/WidgetHost";
import { useWorkspacePreviewCaptureStore } from "../../stores/workspace-preview-capture-store";

const GridWithWidth = WidthProvider(GridLayout);

export function WorkspaceCanvas() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId);
  const widgets = useWidgetsStore((s) => s.widgets);
  const warnings = useWidgetsStore((s) => s.widgetLoadWarnings);
  const setCaptureRoot = useWorkspacePreviewCaptureStore((s) => s.setCaptureRoot);
  const bumpPreviewAfterLayoutInteraction = useWorkspacePreviewCaptureStore(
    (s) => s.bumpPreviewAfterLayoutInteraction,
  );

  const captureRef = useCallback(
    (el: HTMLDivElement | null) => {
      setCaptureRoot(el);
    },
    [setCaptureRoot],
  );

  useEffect(() => {
    if (!activeSpaceId) setCaptureRoot(null);
  }, [activeSpaceId, setCaptureRoot]);

  const sorted = useMemo(() => {
    const list = [...widgets];
    list.sort(
      (a, b) =>
        a.layout.y - b.layout.y || a.layout.x - b.layout.x || a.id.localeCompare(b.id),
    );
    return list;
  }, [widgets]);

  const visible = useMemo(() => sorted.filter((w) => w.status !== "disabled"), [sorted]);

  const rglLayout: Layout = useMemo(
    () =>
      visible.map((w) => ({
        i: w.id,
        x: Math.min(11, Math.max(0, Math.round(w.layout.x))),
        y: Math.max(0, Math.round(w.layout.y)),
        w: Math.min(12, Math.max(1, Math.round(w.layout.w))),
        h: Math.max(1, Math.round(w.layout.h)),
        minW: 2,
        minH:
          w.kind === "stat-ticker"
            ? 1
            : w.kind === "html-card" ||
                w.kind === "note" ||
                w.kind === "airis-agent" ||
                w.kind === "cli-catalog" ||
                w.kind === "checklist" ||
                w.kind === "sequencer-panel" ||
                w.kind === "drum-machine-panel" ||
                w.kind === "piano-roll-panel" ||
                w.kind === "chord-progression-panel" ||
                w.kind === "loop-recorder-panel" ||
                w.kind === "metronome-panel" ||
                w.kind === "synth-keyboard-panel" ||
                w.kind === "audio-visualizer-panel" ||
                w.kind === "mini-player-panel" ||
                w.kind === "karaoke-lyric-panel" ||
                w.kind === "guitar-tuner-panel"
              ? 6
              : 2,
      })),
    [visible],
  );

  /** DOM `setTimeout` returns `number` in browsers; avoid `NodeJS.Timeout` mismatch. */
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const onLayoutChange = useCallback(
    (layout: Layout) => {
      if (!activeSpaceId) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        for (const item of layout) {
          void api.patchWidget(activeSpaceId, item.i, {
            layout: { x: item.x, y: item.y, w: item.w, h: item.h },
          });
        }
        void useWidgetsStore.getState().load(activeSpaceId);
      }, 450);
    },
    [activeSpaceId],
  );

  const onDragStop = useCallback(() => {
    bumpPreviewAfterLayoutInteraction();
  }, [bumpPreviewAfterLayoutInteraction]);

  const onResizeStop = useCallback(() => {
    bumpPreviewAfterLayoutInteraction();
  }, [bumpPreviewAfterLayoutInteraction]);

  if (!activeSpaceId) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500">
        Select or create a space
      </div>
    );
  }

  return (
    <div
      ref={captureRef}
      data-airis-workspace-capture-root
      className="flex min-h-0 flex-1 flex-col space-y-3"
    >
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
          <div className="font-semibold text-amber-200/90">Widget load warnings ({warnings.length})</div>
          <ul className="mt-1 list-inside list-disc text-amber-100/80">
            {warnings.slice(0, 5).map((w) => (
              <li key={w.file}>
                {w.file}: {w.code} — {w.message.slice(0, 120)}
              </li>
            ))}
          </ul>
          {warnings.length > 5 ? <p className="mt-1 text-amber-200/60">…and more</p> : null}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="min-h-[min(50vh,36rem)] rounded-xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">
          No widgets yet — use &quot;Add note widget&quot; or chat with the agent.
        </p>
      ) : (
        <div className="flex min-h-[min(70vh,52rem)] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-1">
          <GridWithWidth
            className="min-h-[min(65vh,48rem)]"
            cols={12}
            rowHeight={36}
            margin={[10, 10]}
            containerPadding={[8, 8]}
            layout={rglLayout}
            onLayoutChange={onLayoutChange}
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
            compactType={null}
            preventCollision
            draggableHandle=".widget-drag-handle"
            draggableCancel="button,input,select,textarea,.widget-frame-action"
            isResizable
            isDraggable
          >
            {visible.map((w) => (
              <div key={w.id} className="h-full">
                <WidgetHost record={w} />
              </div>
            ))}
          </GridWithWidth>
        </div>
      )}
    </div>
  );
}
