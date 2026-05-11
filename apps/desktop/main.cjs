"use strict";

const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("node:path");

/** AIRIS web UI (Vite dev server or static file URL). */
const WEB_URL = process.env.AIRIS_WEB_URL?.trim() || "http://localhost:5173";
/** Keep the AIRIS window above normal apps (set `AIRIS_ELECTRON_ALWAYS_ON_TOP=0` to disable). */
const ALWAYS_ON_TOP = process.env.AIRIS_ELECTRON_ALWAYS_ON_TOP !== "0";

let mainWindow = null;
let workspaceBrowserView = null;

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
  if (workspaceBrowserView) return workspaceBrowserView;
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
      sandbox: true,
    },
  });

  if (ALWAYS_ON_TOP && process.platform === "darwin") {
    /** Stronger than default so the shell stays above typical document windows. */
    mainWindow.setAlwaysOnTop(true, "floating", 1);
  }

  mainWindow.loadURL(WEB_URL).catch((err) => {
    console.error("[AIRIS desktop] Failed to load web UI:", WEB_URL, err);
  });

  mainWindow.on("resize", requestBoundsRefresh);
  mainWindow.on("move", requestBoundsRefresh);
  mainWindow.on("enter-full-screen", requestBoundsRefresh);
  mainWindow.on("leave-full-screen", requestBoundsRefresh);

  mainWindow.on("show", requestBoundsRefresh);

  mainWindow.on("closed", () => {
    mainWindow = null;
    workspaceBrowserView = null;
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
