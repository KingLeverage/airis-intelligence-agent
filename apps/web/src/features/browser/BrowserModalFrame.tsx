import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { BrowserFrameRect } from "../../stores/chrome-store";
import { useChromeStore } from "../../stores/chrome-store";
import type { BrowserTab } from "../../stores/browser-tabs-store";
import { useBrowserTabsStore } from "../../stores/browser-tabs-store";

function tabLabel(t: BrowserTab): string {
  if (!t.url.trim()) return "New tab";
  try {
    return new URL(t.url).hostname.replace(/^www\./, "") || "Tab";
  } catch {
    return t.title || "Tab";
  }
}

function BrowserTabStrip() {
  const tabs = useBrowserTabsStore((s) => s.tabs);
  const activeTabId = useBrowserTabsStore((s) => s.activeTabId);
  const addTab = useBrowserTabsStore((s) => s.addTab);
  const closeTab = useBrowserTabsStore((s) => s.closeTab);
  const selectTab = useBrowserTabsStore((s) => s.selectTab);

  return (
    <>
      {tabs.map((t) => {
        const active = t.id === activeTabId;
        return (
          <div
            key={t.id}
            className={`flex shrink-0 items-stretch rounded-md border text-[11px] transition-colors ${
              active
                ? "border-cyan-500/60 bg-[color:rgba(45,212,191,0.12)] text-cyan-50"
                : "border-transparent bg-[color:rgba(255,255,255,0.04)] text-slate-400 hover:border-slate-600/80 hover:bg-[color:rgba(255,255,255,0.06)]"
            }`}
          >
            <button
              type="button"
              className="max-w-[9.5rem] truncate px-2 py-1.5 text-left font-medium"
              onClick={() => selectTab(t.id)}
            >
              {tabLabel(t)}
            </button>
            {tabs.length > 1 ? (
              <button
                type="button"
                className="px-1.5 py-1 text-slate-500 hover:text-rose-300"
                title="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        title="New tab"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-600/80 text-slate-400 hover:border-cyan-600/60 hover:bg-[color:rgba(45,212,191,0.08)] hover:text-cyan-200"
        onClick={() => addTab()}
      >
        +
      </button>
    </>
  );
}

type BrowserModalFrameProps = {
  children: ReactNode;
};

type ResizeKind = "se" | "e" | "s" | "nw" | "w" | "n" | "ne" | "sw";

function resizeRect(start: BrowserFrameRect, kind: ResizeKind, dx: number, dy: number): BrowserFrameRect {
  const { left: sl, top: st, width: sw, height: sh } = start;
  switch (kind) {
    case "se":
      return { left: sl, top: st, width: sw + dx, height: sh + dy };
    case "e":
      return { left: sl, top: st, width: sw + dx, height: sh };
    case "s":
      return { left: sl, top: st, width: sw, height: sh + dy };
    case "nw":
      return { left: sl + dx, top: st + dy, width: sw - dx, height: sh - dy };
    case "w":
      return { left: sl + dx, top: st, width: sw - dx, height: sh };
    case "n":
      return { left: sl, top: st + dy, width: sw, height: sh - dy };
    case "ne":
      return { left: sl, top: st + dy, width: sw + dx, height: sh - dy };
    case "sw":
      return { left: sl + dx, top: st, width: sw - dx, height: sh + dy };
    default:
      return start;
  }
}

export function BrowserModalFrame({ children }: BrowserModalFrameProps) {
  const mode = useChromeStore((s) => s.browserWindowMode);
  const setMode = useChromeStore((s) => s.setBrowserWindowMode);
  const setOpenPanel = useChromeStore((s) => s.setOpenPanel);
  const browserFrameRect = useChromeStore((s) => s.browserFrameRect);

  const dragRef = useRef<
    | { mode: "move"; sx: number; sy: number; startRect: BrowserFrameRect }
    | { mode: "resize"; kind: ResizeKind; sx: number; sy: number; startRect: BrowserFrameRect }
    | null
  >(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.mode === "move") {
        useChromeStore.getState().setBrowserFrameRect({
          left: d.startRect.left + dx,
          top: d.startRect.top + dy,
        });
      } else {
        const next = resizeRect(d.startRect, d.kind, dx, dy);
        useChromeStore.getState().setBrowserFrameRect(next);
      }
    };
    const end = () => {
      if (dragRef.current) {
        useChromeStore.getState().snapBrowserFrameToEdges();
      }
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const r = useChromeStore.getState().browserFrameRect;
      useChromeStore.getState().setBrowserFrameRect(r);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginMove = (e: React.PointerEvent) => {
    if (mode !== "normal") return;
    e.preventDefault();
    e.stopPropagation();
    const startRect = useChromeStore.getState().browserFrameRect;
    dragRef.current = { mode: "move", sx: e.clientX, sy: e.clientY, startRect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const beginResize = (kind: ResizeKind, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startRect = useChromeStore.getState().browserFrameRect;
    dragRef.current = { mode: "resize", kind, sx: e.clientX, sy: e.clientY, startRect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  if (mode === "minimized") {
    return (
      <button
        type="button"
        className="airis-motion fixed bottom-5 right-5 z-[125] flex max-w-[min(100vw-2rem,18rem)] items-center gap-2 rounded-lg border border-[color:rgba(45,212,191,0.45)] bg-[color:rgba(6,17,31,0.94)] px-3 py-2 text-left text-xs font-medium text-cyan-50/95 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-[color:rgba(6,17,31,1)]"
        onClick={() => setMode("normal")}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400/90" aria-hidden />
        <span className="min-w-0 truncate">Browser — tap to restore</span>
      </button>
    );
  }

  const maximized = mode === "maximized";

  const closeBrowser = () => {
    setOpenPanel(null);
    setMode("normal");
  };

  const framePositionStyle: CSSProperties | undefined = maximized
    ? undefined
    : {
        left: browserFrameRect.left,
        top: browserFrameRect.top,
        width: browserFrameRect.width,
        height: browserFrameRect.height,
      };

  const frameClass = maximized
    ? "airis-glass-1 fixed z-[101] inset-0 flex flex-col overflow-hidden rounded-none border border-[color:var(--airis-border-glass-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:inset-3 sm:rounded-lg"
    : "airis-glass-1 fixed z-[101] flex flex-col overflow-hidden rounded-xl border border-[color:var(--airis-border-glass-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)]";

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px]"
        role="presentation"
        aria-hidden
        onClick={closeBrowser}
      />
      <div className={frameClass} style={framePositionStyle}>
        {!maximized ? (
          <>
            {/* Top-edge handles sit just under the tab strip so tabs stay clickable */}
            <div
              role="separator"
              title="Resize"
              className="absolute left-0 top-[2.35rem] z-[3] h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-br-md hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("nw", e)}
            />
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Resize height"
              className="absolute left-8 right-8 top-[2.35rem] z-[2] h-1.5 cursor-ns-resize touch-none hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("n", e)}
            />
            <div
              role="separator"
              title="Resize"
              className="absolute right-0 top-[2.35rem] z-[3] h-3.5 w-3.5 cursor-nesw-resize touch-none rounded-bl-md hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("ne", e)}
            />
            <div
              role="separator"
              aria-orientation="vertical"
              title="Resize width"
              className="absolute bottom-8 left-0 top-[2.75rem] z-[2] w-1.5 cursor-ew-resize touch-none hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("w", e)}
            />
            <div
              role="separator"
              aria-orientation="vertical"
              title="Resize width"
              className="absolute bottom-8 right-0 top-[2.75rem] z-[2] w-1.5 cursor-ew-resize touch-none hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("e", e)}
            />
            <div
              title="Resize"
              className="absolute bottom-0 left-0 z-[3] h-3.5 w-3.5 cursor-nesw-resize touch-none rounded-tr-md hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("sw", e)}
            />
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Resize height"
              className="absolute bottom-0 left-8 right-8 z-[2] h-1.5 cursor-ns-resize touch-none hover:bg-cyan-500/25"
              onPointerDown={(e) => beginResize("s", e)}
            />
            <div
              title="Resize"
              className="absolute bottom-0 right-0 z-[3] h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-tl-md hover:bg-cyan-500/30"
              onPointerDown={(e) => beginResize("se", e)}
            />
          </>
        ) : null}
        <div className="relative z-10 flex shrink-0 items-center gap-1 border-b border-[color:var(--airis-border-glass)] bg-[color:rgba(6,14,24,0.55)] px-1 py-1 backdrop-blur-sm">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 pl-1">
            <BrowserTabStrip />
            {!maximized ? (
              <div
                role="separator"
                title="Drag to move"
                className="min-h-[28px] min-w-[40px] flex-1 cursor-move touch-none rounded-md hover:bg-[color:rgba(255,255,255,0.04)]"
                onPointerDown={beginMove}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 pr-1">
            <button
              type="button"
              title="Minimize"
              className="flex h-7 w-8 items-center justify-center rounded text-sm text-slate-400 hover:bg-[color:rgba(255,255,255,0.06)] hover:text-slate-200"
              onClick={() => setMode("minimized")}
            >
              &#8211;
            </button>
            <button
              type="button"
              title={maximized ? "Restore" : "Maximize"}
              className="flex h-7 w-8 items-center justify-center rounded text-[11px] text-slate-400 hover:bg-[color:rgba(255,255,255,0.06)] hover:text-slate-200"
              onClick={() => setMode(maximized ? "normal" : "maximized")}
            >
              {maximized ? "❐" : "□"}
            </button>
            <button
              type="button"
              title="Close"
              className="flex h-7 w-8 items-center justify-center rounded text-sm text-slate-400 hover:bg-rose-950/50 hover:text-rose-200"
              onClick={closeBrowser}
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[color:rgba(4,12,22,0.92)]">{children}</div>
      </div>
    </>
  );
}
