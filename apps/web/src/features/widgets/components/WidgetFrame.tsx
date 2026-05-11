import type { ReactNode } from "react";

export type WidgetFrameProps = {
  title: string;
  kind: string;
  widgetId: string;
  compactHeader?: boolean;
  liveWarning?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

/** Shared glass shell for every widget (drag handle class for react-grid-layout). */
export function WidgetFrame(props: WidgetFrameProps) {
  const { title, kind, widgetId, compactHeader, liveWarning, actions, children } = props;
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-950/90 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]">
      <div
        className={`widget-drag-handle flex cursor-grab items-center justify-between gap-2 border-b border-slate-800/80 px-3 active:cursor-grabbing ${compactHeader ? "py-1.5" : "py-2"}`}
      >
        <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <div
          className="widget-frame-action flex shrink-0 items-center gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-slate-600">
            {kind} · {widgetId.slice(0, 8)}…
          </span>
          {actions}
        </div>
      </div>
      {liveWarning ? (
        <div className="border-b border-amber-900/40 bg-amber-950/20 px-3 py-1 text-[10px] text-amber-200/90">
          {liveWarning}
        </div>
      ) : null}
      <div className={`min-h-0 flex-1 overflow-auto ${compactHeader ? "px-2 py-2" : "p-3"}`}>{children}</div>
    </div>
  );
}
