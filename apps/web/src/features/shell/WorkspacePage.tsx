import { useEffect, useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useSpacesStore } from "../../stores/spaces-store";
import { useWidgetsStore } from "../../stores/widgets-store";
import { useChromeStore } from "../../stores/chrome-store";
import { useBrowserStore } from "../../stores/browser-store";
import { AirisHomeShell } from "../../components/airis/AirisHomeShell";
import { AirisActiveSpaceShell } from "../../components/airis/AirisActiveSpaceShell";
import { ActiveSpaceTransitionLayer } from "../../components/airis/ActiveSpaceTransitionLayer";
import { FloatingCommandBar } from "../../components/airis/FloatingCommandBar";
import { BrowserPanel } from "../browser/BrowserPanel";
import { BrowserModalFrame } from "../browser/BrowserModalFrame";
import { ChatPanel } from "../chat/ChatPanel";
import { SkillsPanel } from "./SkillsPanel";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { ExportsPanel } from "./ExportsPanel";

export function WorkspacePage() {
  const settings = useWidgetsStore((s) => s.settings);
  const loadSpaces = useSpacesStore((s) => s.loadSpaces);
  const spacesError = useSpacesStore((s) => s.error);
  const widgetsError = useWidgetsStore((s) => s.error);
  const sessionError = useSessionStore((s) => s.error);
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId);
  const theme = useSessionStore((s) => s.theme);
  const openPanel = useChromeStore((s) => s.openPanel);
  const setOpenPanel = useChromeStore((s) => s.setOpenPanel);
  const refreshSpace = useSessionStore((s) => s.refreshSpace);

  const error = spacesError ?? widgetsError ?? sessionError;

  const [browserHostSpaceId, setBrowserHostSpaceId] = useState<string | null>(null);
  const [browserHomeError, setBrowserHomeError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("panel") === "browser" || q.get("openBrowser") === "1") {
      const bu = q.get("browserUrl") ?? q.get("url");
      if (bu) useChromeStore.getState().setPendingBrowserUrl(bu);
      useChromeStore.getState().setOpenPanel("browser");
      q.delete("panel");
      q.delete("openBrowser");
      q.delete("browserUrl");
      q.delete("url");
      const rest = q.toString();
      const path = `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", path);
    }
  }, []);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    if (settings) useSessionStore.getState().applyWorkspaceSettings(settings);
  }, [settings]);

  useEffect(() => {
    useChromeStore.getState().hydrateOrbForSpace(activeSpaceId);
  }, [activeSpaceId]);

  useEffect(() => {
    if (openPanel !== "agent" || activeSpaceId) return;
    void (async () => {
      const id = await useSpacesStore.getState().getOrCreateHomeChatSpaceId();
      await useSessionStore.getState().loadSessionForSpace(id);
    })();
  }, [openPanel, activeSpaceId]);

  useEffect(() => {
    setBrowserHomeError(null);
    if (openPanel !== "browser" || activeSpaceId) {
      setBrowserHostSpaceId(null);
      return;
    }
    setBrowserHostSpaceId(null);
    void (async () => {
      try {
        const id = await useSpacesStore.getState().getOrCreateHomeChatSpaceId();
        setBrowserHostSpaceId(id);
        await useSessionStore.getState().loadSessionForSpace(id);
        await useBrowserStore.getState().loadSession(id);
      } catch (e) {
        setBrowserHostSpaceId(null);
        setBrowserHomeError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [openPanel, activeSpaceId]);

  return (
    <div
      className="iris-deepfield airis-app airis-motion relative h-screen min-h-0 overflow-hidden"
      data-airis-theme={theme}
    >
      <ActiveSpaceTransitionLayer active={Boolean(activeSpaceId)}>
        {activeSpaceId ? <AirisActiveSpaceShell /> : <AirisHomeShell />}
      </ActiveSpaceTransitionLayer>
      {error && (
        <div className="absolute left-0 right-0 top-0 z-30 border-b border-red-900/50 bg-red-950/80 px-4 py-2 text-center text-sm text-red-100 backdrop-blur-md">
          {error}
        </div>
      )}
      <FloatingCommandBar />
      {!activeSpaceId && openPanel === "agent" && (
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
      {!activeSpaceId && openPanel === "browser" && (
        <BrowserModalFrame>
          {browserHomeError ? (
            <div className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-rose-200">{browserHomeError}</p>
              <button
                type="button"
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => setOpenPanel(null)}
              >
                Close
              </button>
            </div>
          ) : browserHostSpaceId ? (
            <BrowserPanel forcedSpaceId={browserHostSpaceId} />
          ) : (
            <div className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center gap-2 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" aria-hidden />
              <p className="text-sm">Preparing browser…</p>
            </div>
          )}
        </BrowserModalFrame>
      )}
      {activeSpaceId && (
        <>
          <SkillsPanel
            spaceId={activeSpaceId}
            open={openPanel === "skills"}
            onClose={() => setOpenPanel(null)}
          />
          <SnapshotsPanel
            spaceId={activeSpaceId}
            open={openPanel === "snapshots"}
            onClose={() => setOpenPanel(null)}
            onRestored={() => void refreshSpace()}
          />
          <ExportsPanel
            spaceId={activeSpaceId}
            open={openPanel === "exports"}
            onClose={() => setOpenPanel(null)}
          />
        </>
      )}
    </div>
  );
}
