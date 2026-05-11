import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSpacesStore } from "../../stores/spaces-store";
import { useBrowserStore } from "../../stores/browser-store";
import { useBrowserTabsStore } from "../../stores/browser-tabs-store";
import { useChromeStore } from "../../stores/chrome-store";
import { api } from "../../lib/api";
import { resolvePanelFrameSrc } from "./iframe-embed-policy";
import { isExternalBrowserTarget } from "../../lib/external-browser-url";
import { getAirisNativeShell } from "./native-shell";

const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const SPLASH_SRC = `${base}browser-frame.html`;

const SANDBOX_BASE =
  "allow-same-origin allow-scripts allow-forms allow-modals allow-downloads";
/** Extra tokens when server runs full JS preview (pop-ups / some navigations). */
const SANDBOX_UNSAFE_EXTRA =
  " allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";

function isRenderableHttpUrl(u: string): boolean {
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function hostTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export type BrowserPanelProps = {
  /** When set (e.g. Home overlay), use this space instead of `activeSpaceId` from the store. */
  forcedSpaceId?: string;
};

export function BrowserPanel({ forcedSpaceId }: BrowserPanelProps = {}) {
  const activeFromStore = useSpacesStore((s) => s.activeSpaceId);
  const spaceId = forcedSpaceId ?? activeFromStore;

  const nativeShell = useMemo(() => getAirisNativeShell(), []);
  const nativeViewportRef = useRef<HTMLDivElement | null>(null);
  const lastNativeBoundsKey = useRef("");

  const [reloadNonce, setReloadNonce] = useState(0);
  const [previewUnsafeFullPage, setPreviewUnsafeFullPage] = useState(false);
  const tabs = useBrowserTabsStore((s) => s.tabs);
  const activeTabId = useBrowserTabsStore((s) => s.activeTabId);
  const ensureForSpace = useBrowserTabsStore((s) => s.ensureForSpace);
  const updateActiveDraft = useBrowserTabsStore((s) => s.updateActiveDraft);
  const setActiveTabUrl = useBrowserTabsStore((s) => s.setActiveTabUrl);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null;

  const session = useBrowserStore((s) => s.session);
  const loading = useBrowserStore((s) => s.loading);
  const error = useBrowserStore((s) => s.error);
  const lastStubMessage = useBrowserStore((s) => s.lastStubMessage);
  const clear = useBrowserStore((s) => s.clear);
  const loadSession = useBrowserStore((s) => s.loadSession);
  const navigate = useBrowserStore((s) => s.navigate);
  const postAction = useBrowserStore((s) => s.postAction);

  const pendingBrowserUrl = useChromeStore((s) => s.pendingBrowserUrl);
  /** Browser modal drag/resize updates this without resizing the inner slot — ResizeObserver misses it. */
  const browserFrameSig = useChromeStore(
    (s) =>
      `${s.browserFrameRect.left},${s.browserFrameRect.top},${s.browserFrameRect.width},${s.browserFrameRect.height},${s.browserWindowMode}`,
  );

  const tabUrl = activeTab?.url?.trim() ?? "";
  const sessionUrl = session?.currentUrl?.trim() ?? "";
  /** Never treat this SPA’s origin as the browse target (fixes address bar vs native BrowserView). */
  const sessionBrowseUrl = sessionUrl && isExternalBrowserTarget(sessionUrl) ? sessionUrl : "";
  /** Prefer tab; fall back to session only for external URLs so workspace URLs do not clobber Maps. */
  const frameTargetUrl = (tabUrl || sessionBrowseUrl || "").trim();
  const { src: frameSrc, mode: panelFrameMode } = resolvePanelFrameSrc({
    tabUrl: frameTargetUrl,
    spaceId,
    apiBase: base,
    reloadNonce,
    splashSrc: SPLASH_SRC,
  });

  const pushNativeBounds = useCallback(() => {
    if (!nativeShell) return;
    const el = nativeViewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /** Floor origin + ceil edges so the native view fully covers the slot (avoids sub-pixel gaps). */
    const x = Math.floor(r.left);
    const y = Math.floor(r.top);
    const width = Math.max(0, Math.ceil(r.right) - x);
    const height = Math.max(0, Math.ceil(r.bottom) - y);
    const key = `${x}|${y}|${width}|${height}`;
    if (key === lastNativeBoundsKey.current) return;
    lastNativeBoundsKey.current = key;
    void nativeShell.setBounds({ x, y, width, height });
  }, [nativeShell]);

  useLayoutEffect(() => {
    if (spaceId) ensureForSpace(spaceId);
  }, [spaceId, ensureForSpace]);

  useEffect(() => {
    let cancelled = false;
    void api
      .browserCapabilities()
      .then((c) => {
        if (!cancelled) setPreviewUnsafeFullPage(Boolean(c.previewUnsafeFullPage));
      })
      .catch(() => {
        if (!cancelled) setPreviewUnsafeFullPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!nativeShell) return;
    pushNativeBounds();
  }, [nativeShell, browserFrameSig, pushNativeBounds]);

  useLayoutEffect(() => {
    if (!nativeShell) return;
    const el = nativeViewportRef.current;
    if (!el) return;
    pushNativeBounds();
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(() => pushNativeBounds());
    });
    ro.observe(el);
    const offRefresh = nativeShell.onRequestBoundsRefresh(() => {
      window.requestAnimationFrame(() => pushNativeBounds());
    });
    const bumpBounds = () => window.requestAnimationFrame(() => pushNativeBounds());
    window.addEventListener("scroll", bumpBounds, true);
    window.addEventListener("resize", bumpBounds);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", bumpBounds);
    vv?.addEventListener("scroll", bumpBounds);
    /** Dragging the browser frame moves `fixed` CSS without resizing the slot — keep rAF sync. */
    let raf = 0;
    const rafLoop = () => {
      pushNativeBounds();
      raf = window.requestAnimationFrame(rafLoop);
    };
    raf = window.requestAnimationFrame(rafLoop);
    const settle = window.setTimeout(() => pushNativeBounds(), 120);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      ro.disconnect();
      offRefresh();
      window.removeEventListener("scroll", bumpBounds, true);
      window.removeEventListener("resize", bumpBounds);
      vv?.removeEventListener("resize", bumpBounds);
      vv?.removeEventListener("scroll", bumpBounds);
      lastNativeBoundsKey.current = "";
      void nativeShell.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    };
  }, [nativeShell, pushNativeBounds]);

  useEffect(() => {
    if (!nativeShell || !spaceId) return;
    const off = nativeShell.onNavigated((url) => {
      if (!/^https?:\/\//i.test(url)) return;
      setActiveTabUrl(url, hostTitle(url));
      updateActiveDraft(url);
      void navigate(spaceId, url, "visual");
    });
    return off;
  }, [nativeShell, spaceId, navigate, setActiveTabUrl, updateActiveDraft]);

  useEffect(() => {
    if (!nativeShell || !frameTargetUrl || !isRenderableHttpUrl(frameTargetUrl)) return;
    if (!isExternalBrowserTarget(frameTargetUrl)) return;
    void nativeShell.loadURL(frameTargetUrl.trim());
  }, [nativeShell, frameTargetUrl, reloadNonce]);

  /** If the tab bar was polluted with this app’s origin, snap it to the real BrowserView URL. */
  useEffect(() => {
    if (!nativeShell?.getCurrentUrl) return;
    if (!tabUrl || isExternalBrowserTarget(tabUrl)) return;
    let cancelled = false;
    void nativeShell.getCurrentUrl().then((u) => {
      if (cancelled || !u || typeof u !== "string") return;
      if (!/^https?:\/\//i.test(u) || !isExternalBrowserTarget(u)) return;
      setActiveTabUrl(u, hostTitle(u));
    });
    return () => {
      cancelled = true;
    };
  }, [nativeShell, tabUrl, setActiveTabUrl]);

  const iframeSandbox = previewUnsafeFullPage ? `${SANDBOX_BASE}${SANDBOX_UNSAFE_EXTRA}` : SANDBOX_BASE;

  useEffect(() => {
    if (!spaceId || !pendingBrowserUrl?.trim()) return;
    const raw = useChromeStore.getState().takePendingBrowserUrl();
    if (!raw?.trim()) return;
    void (async () => {
      // visual: session URL for live iframe without server HTML fetch (avoids 403 noise on strict sites).
      await navigate(spaceId, raw.trim(), "visual");
      const u = useBrowserStore.getState().session?.currentUrl?.trim();
      if (u && isRenderableHttpUrl(u)) {
        setActiveTabUrl(u, hostTitle(u));
        updateActiveDraft(u);
      }
    })();
  }, [spaceId, pendingBrowserUrl, navigate, setActiveTabUrl, updateActiveDraft]);

  useEffect(() => {
    if (!spaceId) {
      clear();
      return;
    }
    void loadSession(spaceId);
  }, [spaceId, clear, loadSession]);

  const chromeDisabled = loading || !spaceId;

  const go = async () => {
    if (!spaceId || !activeTab) return;
    const raw = (activeTab.draft ?? "").trim();
    if (!raw) return;
    await navigate(spaceId, raw, "visual");
    const u = useBrowserStore.getState().session?.currentUrl?.trim();
    if (u) {
      setActiveTabUrl(u, hostTitle(u));
      updateActiveDraft(u);
    }
  };

  const draftValue = activeTab?.draft ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950/50">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 px-2 py-1.5">
        <button
          type="button"
          title={nativeShell ? "Back (native browser)" : "Back (session history)"}
          className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          disabled={chromeDisabled}
          onClick={() => {
            if (nativeShell) void nativeShell.goBack();
            else if (spaceId) void postAction(spaceId, { type: "back" });
          }}
        >
          ←
        </button>
        <button
          type="button"
          title="Reload page in frame"
          className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          disabled={!spaceId && !nativeShell}
          onClick={() => {
            if (nativeShell) void nativeShell.reload();
            else {
              setReloadNonce((n) => n + 1);
              if (spaceId) void loadSession(spaceId);
            }
          }}
        >
          ↻
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
          value={draftValue}
          onChange={(e) => updateActiveDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void go();
          }}
          placeholder="https://…"
          disabled={chromeDisabled}
          spellCheck={false}
        />
        <button
          type="button"
          className="shrink-0 rounded-md bg-cyan-950/80 px-3 py-1 text-xs font-medium text-cyan-200 ring-1 ring-cyan-900 disabled:opacity-40"
          disabled={chromeDisabled || !draftValue.trim()}
          onClick={() => void go()}
        >
          Go
        </button>
        {spaceId && frameTargetUrl && isRenderableHttpUrl(frameTargetUrl) ? (
          <button
            type="button"
            title="Open this URL in your system browser (full site)"
            className="shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-cyan-200"
            onClick={() => window.open(frameTargetUrl, "_blank", "noopener,noreferrer")}
          >
            ↗
          </button>
        ) : null}
      </div>

      <div className="flex min-h-[min(50vh,28rem)] min-w-0 flex-1 flex-col border-b border-slate-800 bg-black">
        <div className="relative min-h-0 flex-1">
          {nativeShell ? (
            <div
              ref={nativeViewportRef}
              className="absolute inset-0 min-h-0 min-w-0 bg-black"
              aria-label="Native browser viewport"
            />
          ) : (
            <iframe
              key={`${frameSrc}|${reloadNonce}`}
              title="Embedded browser"
              className="absolute inset-0 h-full w-full border-0"
              src={frameSrc}
              sandbox={iframeSandbox}
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
        <p className="shrink-0 border-t border-slate-800/80 bg-slate-950/90 px-2 py-1.5 text-center text-[10px] leading-snug text-slate-500">
          {nativeShell ? (
            <>
              <strong className="font-medium text-emerald-200/90">Native Chromium</strong> (Electron <code className="rounded bg-slate-900 px-1 text-[9px] text-slate-400">BrowserView</code>) — real site JS. Scraping via the agent uses server <strong className="text-slate-400">Playwright</strong> + <code className="rounded bg-slate-900 px-1 text-[9px] text-slate-400">browser.navigate</code> / <code className="rounded bg-slate-900 px-1 text-[9px] text-slate-400">browser.evaluate</code> (see server <code className="rounded bg-slate-900 px-1 text-[9px] text-slate-400">.env</code>).
            </>
          ) : panelFrameMode === "preview_mirror" ? (
            <>
              {previewUnsafeFullPage ? (
                <>
                  <strong className="font-medium text-rose-200/90">Full JS preview</strong> (server flag) — closer to a real tab; some sites still break (origin/CSP/login). Use{" "}
                  <strong className="text-slate-400">↗</strong> when stuck.
                </>
              ) : (
                <>
                  <strong className="font-medium text-amber-200/90">In-app preview</strong> — scripts stripped by default; set{" "}
                  <code className="rounded bg-slate-900 px-1 text-[9px] text-slate-400">AIRIS_PREVIEW_UNSAFE_FULL_PAGE=1</code> on the server for full JS (solo machine only).{" "}
                  <strong className="text-slate-400">↗</strong> opens a normal browser tab.
                </>
              )}
              <span className="mx-1 text-slate-600">·</span>
            </>
          ) : (
            <>
              <strong className="font-medium text-slate-400">Live embed</strong> — JS runs here (loopback dev servers only in this mode).
              <span className="mx-1 text-slate-600">·</span>
            </>
          )}
        </p>
      </div>

      {error ? (
        <div className="mx-3 mt-2 shrink-0 rounded border border-rose-900/60 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-200">
          {error}
        </div>
      ) : null}
      {lastStubMessage ? (
        <div className="mx-3 mt-2 shrink-0 rounded border border-amber-900/50 bg-amber-950/30 px-2 py-1.5 text-[10px] text-amber-100/90">
          {lastStubMessage}
        </div>
      ) : null}
    </div>
  );
}
