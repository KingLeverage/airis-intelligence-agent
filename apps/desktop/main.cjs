"use strict";

const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("node:path");

/**
 * AIRIS web UI (Vite dev server or static file URL).
 * Default `127.0.0.1` (not `localhost`) so Electron matches `wait-on tcp:127.0.0.1:5173` and avoids
 * macOS/IPv6 cases where `localhost` → ::1 while Vite is only on IPv4.
 */
const WEB_URL = process.env.AIRIS_WEB_URL?.trim() || "http://127.0.0.1:5173";
/** Keep the AIRIS window above normal apps (set `AIRIS_ELECTRON_ALWAYS_ON_TOP=0` to disable). */
const ALWAYS_ON_TOP = process.env.AIRIS_ELECTRON_ALWAYS_ON_TOP !== "0";

let mainWindow = null;
let workspaceBrowserView = null;
/** True after the user has sent real Browser panel bounds (width/height ≥ 2). Never cleared on hide. */
let __airisViewWasUserSized = false;
/** Shared promise: first navigation to `about:blank` so `executeJavaScript` has a real document. */
let __airisViewInitialLoadPromise = null;

function isAllowedHttpUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function attachWorkspaceBrowserViewListeners(bv) {
  if (bv.__airisListenersAttached) return;
  bv.__airisListenersAttached = true;

  const sendNav = (url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("airis:native-browser:navigated", url);
    }
  };
  bv.webContents.on("did-navigate", (_e, url) => sendNav(url));
  bv.webContents.on("did-navigate-in-page", (_e, url) => sendNav(url));

  /**
   * Notion, YouTube, etc. often use `window.open` / `target=_blank`. Without this, Electron
   * spawns a **separate BrowserWindow** so the page appears “floating” outside the AIRIS panel.
   */
  bv.webContents.setWindowOpenHandler((details) => {
    const url = typeof details.url === "string" ? details.url.trim() : "";
    if (url && isAllowedHttpUrl(url)) {
      void bv.webContents.loadURL(url);
    }
    return { action: "deny" };
  });
}

function ensureWorkspaceBrowserView() {
  if (workspaceBrowserView && !workspaceBrowserView.webContents.isDestroyed()) {
    return workspaceBrowserView;
  }
  if (workspaceBrowserView) {
    __airisViewInitialLoadPromise = null;
  }
  workspaceBrowserView = null;
  workspaceBrowserView = new BrowserView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      /** Isolated storage/cookies for the workspace browser only. */
      partition: "persist:airis-workspace-browser",
    },
  });
  try {
    workspaceBrowserView.setBackgroundColor("#000000");
  } catch {
    /* optional in older Electron */
  }
  if (mainWindow) {
    attachWorkspaceBrowserViewListeners(workspaceBrowserView);
  }
  return workspaceBrowserView;
}

/** Create/attach BrowserView when server-driven native IPC runs before the user opened the browser panel. */
async function ensureBrowserViewReadyForNativeIpc() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  let bv = workspaceBrowserView;
  const isFreshlyCreated = !bv || bv.webContents.isDestroyed();
  if (isFreshlyCreated) {
    bv = ensureWorkspaceBrowserView();
  }
  if (mainWindow.getBrowserView() !== bv) {
    mainWindow.setBrowserView(bv);
  }
  // Chromium marks BrowserViews positioned entirely outside their parent window's
  // drawable region as document.visibilityState="hidden" and freezes layout
  // (innerWidth=0, clientHeight=0). Google Maps then refuses to virtualize results.
  // Keep the view inside the content bounds; tuck it along the bottom (y just below
  // the visible area) so it stays visible to Chromium without painting over the shell.
  const winBounds = mainWindow.getContentBounds();
  const desiredWidth = Math.min(1280, Math.max(800, winBounds.width));
  const desiredHeight = Math.min(900, Math.max(600, winBounds.height));
  const b = bv.getBounds();
  const needsResize = b.width < 800 || b.height < 600 || b.x < 0 || b.y < 0;
  if (needsResize) {
    bv.setBounds({ x: 0, y: winBounds.height - 1, width: desiredWidth, height: desiredHeight });
  }
  // Disable background throttling so Maps keeps running JS at full speed.
  try {
    bv.webContents.setBackgroundThrottling(false);
  } catch {
    /* older Electron may not have this */
  }
  // First-ever IPC use: load about:blank so executeJavaScript has a real document.
  const currentUrl = (() => {
    try {
      return bv.webContents.getURL() || "";
    } catch {
      return "";
    }
  })();
  if (!currentUrl && !__airisViewInitialLoadPromise) {
    __airisViewInitialLoadPromise = new Promise((resolve) => {
      const done = () => resolve();
      bv.webContents.once("did-finish-load", done);
      bv.webContents.once("did-fail-load", done);
      setTimeout(done, 4000); // hard cap
      bv.webContents.loadURL("about:blank").catch(done);
    });
  }
  if (__airisViewInitialLoadPromise) {
    await __airisViewInitialLoadPromise;
  }
  return bv;
}

function detachWorkspaceBrowserView() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bv = workspaceBrowserView;
  if (bv && mainWindow.getBrowserView() === bv) {
    mainWindow.setBrowserView(null);
  }
}

function requestBoundsRefresh() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("airis:native-browser:request-bounds");
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: "AIRIS",
    alwaysOnTop: ALWAYS_ON_TOP,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      /**
       * Must be false for the shell: Vite dev (HMR / dynamic imports) often fails in a fully sandboxed
       * renderer, which shows a blank window while normal Chrome at :5173 works. Untrusted pages stay
       * in `BrowserView` below, which keeps `sandbox: true`.
       */
      sandbox: false,
    },
  });

  if (ALWAYS_ON_TOP && process.platform === "darwin") {
    /** Stronger than default so the shell stays above typical document windows. */
    mainWindow.setAlwaysOnTop(true, "floating", 1);
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
    if (isMainFrame) {
      console.error(
        "[AIRIS desktop] Main window failed to load:",
        { code, desc, url, webUrl: WEB_URL },
      );
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    try {
      const u = mainWindow.webContents.getURL();
      console.log("[AIRIS desktop] Main window finished load:", u || WEB_URL);
    } catch {
      console.log("[AIRIS desktop] Main window finished load");
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[AIRIS desktop] Renderer process gone:", details);
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, err) => {
    console.error("[AIRIS desktop] Preload error:", preloadPath, err);
  });

  mainWindow.loadURL(WEB_URL).catch((err) => {
    console.error("[AIRIS desktop] Failed to load web UI:", WEB_URL, err);
  });

  if (process.env.AIRIS_ELECTRON_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("resize", requestBoundsRefresh);
  mainWindow.on("move", requestBoundsRefresh);
  mainWindow.on("enter-full-screen", requestBoundsRefresh);
  mainWindow.on("leave-full-screen", requestBoundsRefresh);

  mainWindow.on("show", requestBoundsRefresh);

  mainWindow.on("closed", () => {
    mainWindow = null;
    workspaceBrowserView = null;
    __airisViewInitialLoadPromise = null;
    __airisViewWasUserSized = false;
  });
}

function registerIpc() {
  ipcMain.handle("airis:native-browser:setBounds", (_event, bounds) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    const x = Math.floor(Number(bounds?.x) || 0);
    const y = Math.floor(Number(bounds?.y) || 0);
    /** Ceil size so fractional CSS rects don’t leave a 1px gap (common on Retina / zoom). */
    const width = Math.ceil(Number(bounds?.width) || 0);
    const height = Math.ceil(Number(bounds?.height) || 0);
    if (width < 2 || height < 2) {
      detachWorkspaceBrowserView();
      return { ok: true, hidden: true };
    }
    __airisViewWasUserSized = true;
    const bv = ensureWorkspaceBrowserView();
    if (mainWindow.getBrowserView() !== bv) {
      mainWindow.setBrowserView(bv);
    }
    bv.setBounds({ x, y, width, height });
    return { ok: true };
  });

  ipcMain.handle("airis:native-browser:loadURL", async (_event, urlStr) => {
    if (typeof urlStr !== "string" || !isAllowedHttpUrl(urlStr)) {
      return { ok: false, error: "invalid_url" };
    }
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    const bv = ensureWorkspaceBrowserView();
    await bv.webContents.loadURL(urlStr);
    return { ok: true };
  });

  ipcMain.handle("airis:native-browser:goBack", () => {
    const bv = workspaceBrowserView;
    if (bv?.webContents.canGoBack()) {
      bv.webContents.goBack();
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle("airis:native-browser:reload", () => {
    workspaceBrowserView?.webContents.reload();
    return { ok: true };
  });

  ipcMain.handle("airis:native-browser:getCurrentUrl", () => {
    if (!workspaceBrowserView || workspaceBrowserView.webContents.isDestroyed()) {
      return "";
    }
    try {
      return workspaceBrowserView.webContents.getURL() || "";
    } catch {
      return "";
    }
  });

  ipcMain.handle("airis:native-browser:evaluate", async (_event, payload) => {
    const bv = await ensureBrowserViewReadyForNativeIpc();
    try {
      const probeResult = await bv.webContents.executeJavaScript(
        "JSON.stringify({ iw: window.innerWidth, ih: window.innerHeight, dw: document.documentElement.clientWidth, dh: document.documentElement.clientHeight, vis: document.visibilityState })",
        true,
      );
      console.log("[AIRIS desktop] viewport probe:", probeResult);
    } catch (err) {
      console.log("[AIRIS desktop] viewport probe failed:", String(err));
    }
    if (!bv || bv.webContents.isDestroyed()) {
      return { ok: false, error: "no_browser_view" };
    }
    const expression = payload?.expression;
    if (typeof expression !== "string") {
      return { ok: false, error: "invalid_expression" };
    }
    const rawTimeout = Number(payload?.timeoutMs);
    const timeoutMs = Math.min(
      Math.max(Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 15_000, 1),
      300_000,
    );
    let timeoutHandle = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      });
      const result = await Promise.race([bv.webContents.executeJavaScript(expression, true), timeoutPromise]);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  });

  ipcMain.handle("airis:native-browser:extractText", async () => {
    const bv = await ensureBrowserViewReadyForNativeIpc();
    if (!bv || bv.webContents.isDestroyed()) {
      return { ok: false, error: "no_browser_view" };
    }
    const wc = bv.webContents;
    try {
      const url = wc.getURL() || "";
      const title = wc.getTitle() || "";
      let text = await wc.executeJavaScript("document.body ? document.body.innerText : ''", true);
      if (typeof text !== "string") text = String(text ?? "");
      const cap = 200_000;
      const marker = "\n…[truncated]";
      if (text.length > cap) {
        text = text.slice(0, Math.max(0, cap - marker.length)) + marker;
      }
      return { ok: true, url, title, text };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  });

  ipcMain.handle("airis:native-browser:extractHtml", async () => {
    const bv = await ensureBrowserViewReadyForNativeIpc();
    if (!bv || bv.webContents.isDestroyed()) {
      return { ok: false, error: "no_browser_view" };
    }
    const wc = bv.webContents;
    try {
      const url = wc.getURL() || "";
      const title = wc.getTitle() || "";
      let html = await wc.executeJavaScript("document.documentElement ? document.documentElement.outerHTML : ''", true);
      if (typeof html !== "string") html = String(html ?? "");
      const cap = 500_000;
      const marker = "\n…[truncated]";
      if (html.length > cap) {
        html = html.slice(0, Math.max(0, cap - marker.length)) + marker;
      }
      return { ok: true, url, title, html };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  });

  ipcMain.handle("airis:native-browser:scrollWheel", async (_event, payload) => {
    const bv = await ensureBrowserViewReadyForNativeIpc();
    if (!bv || bv.webContents.isDestroyed()) {
      return { ok: false, error: "no_browser_view" };
    }
    const wc = bv.webContents;
    const x = Math.floor(Number(payload?.x) || 200);
    const y = Math.floor(Number(payload?.y) || 300);
    const deltaY = Math.round(Number(payload?.deltaY) || 800);
    const steps = Math.min(20, Math.max(1, Math.round(Number(payload?.steps) || 4)));
    const stepDelayMs = Math.min(500, Math.max(0, Math.round(Number(payload?.stepDelayMs) || 80)));
    const perStep = Math.max(1, Math.round(deltaY / steps));
    try {
      wc.sendInputEvent({
        type: "mouseMove",
        x,
        y,
        button: "left",
        globalX: x,
        globalY: y,
      });
      await new Promise((r) => setTimeout(r, 40));
      for (let i = 0; i < steps; i++) {
        wc.sendInputEvent({
          type: "mouseWheel",
          x,
          y,
          deltaX: 0,
          deltaY: -perStep,
          wheelTicksX: 0,
          wheelTicksY: -1,
          phase: i === 0 ? "began" : "changed",
          canScroll: true,
        });
        if (i < steps - 1) {
          await new Promise((r) => setTimeout(r, stepDelayMs));
        }
      }
      wc.sendInputEvent({
        type: "mouseWheel",
        x,
        y,
        deltaX: 0,
        deltaY: 0,
        wheelTicksX: 0,
        wheelTicksY: 0,
        phase: "ended",
        canScroll: true,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
