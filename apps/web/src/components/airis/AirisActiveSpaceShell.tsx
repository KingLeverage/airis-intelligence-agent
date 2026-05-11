import { useChromeStore } from "../../stores/chrome-store";
import { TopRail } from "./TopRail";
import { WorkspaceCanvas } from "../../features/canvas/WorkspaceCanvas";
import { SpacePreviewSync } from "../../features/space-preview/SpacePreviewSync";
import { BrowserPanel } from "../../features/browser/BrowserPanel";
import { BrowserModalFrame } from "../../features/browser/BrowserModalFrame";
import { ChatPanel } from "../../features/chat/ChatPanel";
import { PanelsSection } from "./PanelsSection";

export function AirisActiveSpaceShell() {
  const openPanel = useChromeStore((s) => s.openPanel);
  const setOpenPanel = useChromeStore((s) => s.setOpenPanel);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpacePreviewSync />
      <TopRail variant="space" />
      <div className="shrink-0 border-b border-[color:var(--airis-border-glass)] bg-[color:rgba(8,10,18,0.55)] px-3 py-2 backdrop-blur-md sm:px-4">
        <PanelsSection spaceActive density="toolbar" />
      </div>
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-5">
          <WorkspaceCanvas />
        </main>
        {openPanel === "browser" && (
          <BrowserModalFrame>
            <BrowserPanel />
          </BrowserModalFrame>
        )}
        {openPanel === "agent" && (
          <div
            className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px] md:bg-black/35"
            role="presentation"
            onClick={() => setOpenPanel(null)}
          >
            <div
              className="airis-glass-1 flex h-full w-full max-w-md flex-col border-l border-[color:var(--airis-border-glass-strong)] shadow-[-12px_0_40px_rgba(0,0,0,0.35)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[color:var(--airis-border-glass)] px-3 py-2">
                <span className="text-xs font-medium text-[color:var(--airis-text-secondary)]">Agent</span>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-[color:var(--airis-text-tertiary)] hover:bg-[color:rgba(255,255,255,0.06)]"
                  onClick={() => setOpenPanel(null)}
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel embedded />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
