import { create } from "zustand";

export type PanelId = "agent" | "browser" | "snapshots" | "skills" | "exports";

export type BrowserWindowMode = "normal" | "maximized" | "minimized";

export type OrbVisualState =
  | "idle"
  | "hover"
  | "listening"
  | "thinking"
  | "acting"
  | "success"
  | "error"
  | "collapsed"
  | "expanded";

function orbStorageKey(spaceId: string | null): string {
  return spaceId ? `airis.orbAnchor.${spaceId}` : `airis.orbAnchor.home`;
}

export function defaultOrbAnchor(): { left: number; bottom: number } {
  if (typeof window === "undefined") return { left: 200, bottom: 40 };
  return { left: Math.round(window.innerWidth / 2 - 28), bottom: 40 };
}

const CMD_PREFS_KEY = "airis.commandBar.prefs";

function readCommandPrefs(): { fullMode: boolean; compactContext: boolean } {
  if (typeof window === "undefined") return { fullMode: false, compactContext: false };
  try {
    const raw = localStorage.getItem(CMD_PREFS_KEY);
    if (!raw) return { fullMode: false, compactContext: false };
    const j = JSON.parse(raw) as { fullMode?: boolean; compactContext?: boolean };
    return {
      fullMode: Boolean(j.fullMode),
      compactContext: Boolean(j.compactContext),
    };
  } catch {
    return { fullMode: false, compactContext: false };
  }
}

function persistCommandPrefs(fullMode: boolean, compactContext: boolean): void {
  try {
    localStorage.setItem(CMD_PREFS_KEY, JSON.stringify({ fullMode, compactContext }));
  } catch {
    /* ignore */
  }
}

export type BrowserFrameRect = { left: number; top: number; width: number; height: number };

const BROWSER_FRAME_RECT_KEY = "airis.browserFrame.rect";
const LEGACY_BROWSER_FRAME_SIZE_KEY = "airis.browserFrame.size";

const DEFAULT_FRAME_WH = { width: 1120, height: 780 };

function centeredRect(w: number, h: number): BrowserFrameRect {
  if (typeof window === "undefined") {
    return { left: 80, top: 60, width: w, height: h };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = Math.min(Math.max(380, w), vw - 16);
  const ch = Math.min(Math.max(320, h), vh - 16);
  return {
    left: Math.round((vw - cw) / 2),
    top: Math.round((vh - ch) / 2),
    width: cw,
    height: ch,
  };
}

function readBrowserFrameRect(): BrowserFrameRect {
  if (typeof window === "undefined") {
    return { left: 80, top: 60, ...DEFAULT_FRAME_WH };
  }
  try {
    const raw = localStorage.getItem(BROWSER_FRAME_RECT_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<BrowserFrameRect>;
      if (
        typeof j.left === "number" &&
        typeof j.top === "number" &&
        typeof j.width === "number" &&
        typeof j.height === "number"
      ) {
        return { left: j.left, top: j.top, width: j.width, height: j.height };
      }
    }
    const legacyRaw = localStorage.getItem(LEGACY_BROWSER_FRAME_SIZE_KEY);
    if (legacyRaw) {
      const j = JSON.parse(legacyRaw) as { width?: number; height?: number };
      const w = typeof j.width === "number" ? j.width : DEFAULT_FRAME_WH.width;
      const h = typeof j.height === "number" ? j.height : DEFAULT_FRAME_WH.height;
      const r = centeredRect(w, h);
      persistBrowserFrameRect(r);
      return r;
    }
  } catch {
    /* ignore */
  }
  return centeredRect(DEFAULT_FRAME_WH.width, DEFAULT_FRAME_WH.height);
}

function persistBrowserFrameRect(r: BrowserFrameRect): void {
  try {
    localStorage.setItem(BROWSER_FRAME_RECT_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function clampBrowserFrameRect(r: BrowserFrameRect): BrowserFrameRect {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const pad = 8;
  const minW = 380;
  const minH = 320;
  const w = Math.min(Math.max(minW, r.width), Math.max(minW, vw - 2 * pad));
  const h = Math.min(Math.max(minH, r.height), Math.max(minH, vh - 2 * pad));
  const left = Math.min(Math.max(pad, r.left), vw - w - pad);
  const top = Math.min(Math.max(pad, r.top), vh - h - pad);
  return { left, top, width: w, height: h };
}

/** When the frame is dropped near a viewport edge, snap flush to that edge (corner-friendly). */
export function snapBrowserFrameRect(r: BrowserFrameRect): BrowserFrameRect {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const SNAP = 28;
  const PAD = 8;
  let { left, top, width, height } = r;
  if (left <= SNAP) left = PAD;
  if (top <= SNAP) top = PAD;
  if (vw - left - width <= SNAP) left = vw - width - PAD;
  if (vh - top - height <= SNAP) top = vh - height - PAD;
  return clampBrowserFrameRect({ left, top, width, height });
}

/** Keep orb + expanded cluster inside viewport (approximate footprint). */
export function clampOrbToViewport(
  left: number,
  bottom: number,
  expanded: boolean,
  vw: number,
  vh: number,
  fullMode = false,
): { left: number; bottom: number } {
  const clusterW = expanded ? Math.min(fullMode ? 640 : 460, vw - 24) : 72;
  const clusterH = expanded ? (fullMode ? 380 : 300) : 72;
  const m = 10;
  return {
    left: Math.min(Math.max(m, left), vw - clusterW - m),
    bottom: Math.min(Math.max(m, bottom), vh - clusterH - m),
  };
}

export function readOrbAnchor(spaceId: string | null): { left: number; bottom: number } {
  try {
    const raw = localStorage.getItem(orbStorageKey(spaceId));
    if (raw) {
      const p = JSON.parse(raw) as { left?: number; bottom?: number };
      if (typeof p.left === "number" && typeof p.bottom === "number") {
        return { left: p.left, bottom: p.bottom };
      }
    }
  } catch {
    /* ignore */
  }
  return defaultOrbAnchor();
}

function persistOrbAnchor(spaceId: string | null, left: number, bottom: number): void {
  try {
    localStorage.setItem(orbStorageKey(spaceId), JSON.stringify({ left, bottom }));
  } catch {
    /* ignore */
  }
}

interface ChromeState {
  /** When false, only the orb is shown (workspace default). */
  airisExpanded: boolean;
  setAirisExpanded: (v: boolean) => void;
  toggleAirisExpanded: () => void;
  /** Orb anchor: distance from viewport left / bottom (px). */
  orbAnchor: { left: number; bottom: number };
  setOrbAnchor: (left: number, bottom: number, spaceId: string | null) => void;
  nudgeOrbAnchor: (dLeft: number, dBottom: number, spaceId: string | null, expanded: boolean) => void;
  hydrateOrbForSpace: (spaceId: string | null) => void;
  isDragging: boolean;
  setDragging: (v: boolean) => void;
  openPanel: PanelId | null;
  setOpenPanel: (id: PanelId | null) => void;
  togglePanel: (id: PanelId) => void;
  /** In-app browser modal size (when `openPanel === "browser"`). */
  browserWindowMode: BrowserWindowMode;
  setBrowserWindowMode: (m: BrowserWindowMode) => void;
  /** One-shot URL to open when the browser panel mounts (CLI / command bar). Cleared by `takePendingBrowserUrl`. */
  pendingBrowserUrl: string | null;
  setPendingBrowserUrl: (url: string | null) => void;
  takePendingBrowserUrl: () => string | null;
  /** User-positioned / resizable in-app browser window (normal mode). */
  browserFrameRect: BrowserFrameRect;
  setBrowserFrameRect: (patch: Partial<BrowserFrameRect>) => void;
  snapBrowserFrameToEdges: () => void;
  orbState: OrbVisualState;
  setOrbState: (s: OrbVisualState) => void;
  /** Wider / taller command surface when expanded */
  commandBarFullMode: boolean;
  setCommandBarFullMode: (v: boolean) => void;
  toggleCommandBarFullMode: () => void;
  /** Less chrome: single-line input, hide footer hint */
  commandBarCompactContext: boolean;
  setCommandBarCompactContext: (v: boolean) => void;
  toggleCommandBarCompactContext: () => void;
}

export const useChromeStore = create<ChromeState>((set, get) => ({
  ...(() => {
    const p = readCommandPrefs();
    return {
      commandBarFullMode: p.fullMode,
      commandBarCompactContext: p.compactContext,
      browserFrameRect: clampBrowserFrameRect(readBrowserFrameRect()),
    };
  })(),
  airisExpanded: false,
  setAirisExpanded: (v) =>
    set({
      airisExpanded: v,
      orbState: v ? "expanded" : "collapsed",
    }),
  toggleAirisExpanded: () => {
    const next = !get().airisExpanded;
    set({
      airisExpanded: next,
      orbState: next ? "expanded" : "collapsed",
    });
  },

  orbAnchor: defaultOrbAnchor(),
  setOrbAnchor: (left, bottom, spaceId) => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const s = get();
    const c = clampOrbToViewport(left, bottom, s.airisExpanded, vw, vh, s.commandBarFullMode);
    persistOrbAnchor(spaceId, c.left, c.bottom);
    set({ orbAnchor: c });
  },

  nudgeOrbAnchor: (dLeft, dBottom, spaceId, expanded) => {
    const cur = get().orbAnchor;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const c = clampOrbToViewport(
      cur.left + dLeft,
      cur.bottom + dBottom,
      expanded,
      vw,
      vh,
      get().commandBarFullMode,
    );
    persistOrbAnchor(spaceId, c.left, c.bottom);
    set({ orbAnchor: c });
  },

  hydrateOrbForSpace: (spaceId) => {
    const raw = readOrbAnchor(spaceId);
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const c = clampOrbToViewport(raw.left, raw.bottom, false, vw, vh);
    set({ orbAnchor: c, airisExpanded: false, orbState: "collapsed" });
  },

  isDragging: false,
  setDragging: (v) => set({ isDragging: v }),
  openPanel: null,
  setOpenPanel: (id) =>
    set((s) => ({
      openPanel: id,
      /** Collapse command bar when opening browser so Electron BrowserView is not obscured by expanded chat. */
      airisExpanded: id === "browser" ? false : s.airisExpanded,
      browserWindowMode: id === "browser" ? s.browserWindowMode : "normal",
      pendingBrowserUrl: id === "browser" ? s.pendingBrowserUrl : null,
    })),
  togglePanel: (id) => {
    const cur = get().openPanel;
    if (cur === id) {
      if (id === "browser" && get().browserWindowMode === "minimized") {
        set({ browserWindowMode: "normal" });
        return;
      }
      set({ openPanel: null, browserWindowMode: "normal", pendingBrowserUrl: null });
      return;
    }
    set({
      openPanel: id,
      airisExpanded: id === "browser" ? false : get().airisExpanded,
      browserWindowMode: id === "browser" ? get().browserWindowMode : "normal",
      pendingBrowserUrl: id === "browser" ? get().pendingBrowserUrl : null,
    });
  },

  browserWindowMode: "normal",
  setBrowserWindowMode: (m) => set({ browserWindowMode: m }),
  pendingBrowserUrl: null,
  setPendingBrowserUrl: (url) => set({ pendingBrowserUrl: url }),
  takePendingBrowserUrl: () => {
    const u = get().pendingBrowserUrl;
    set({ pendingBrowserUrl: null });
    return u;
  },

  setBrowserFrameRect: (patch) => {
    const cur = get().browserFrameRect;
    const next = clampBrowserFrameRect({ ...cur, ...patch });
    persistBrowserFrameRect(next);
    set({ browserFrameRect: next });
  },
  snapBrowserFrameToEdges: () => {
    const cur = get().browserFrameRect;
    const next = snapBrowserFrameRect(cur);
    if (
      next.left === cur.left &&
      next.top === cur.top &&
      next.width === cur.width &&
      next.height === cur.height
    ) {
      return;
    }
    persistBrowserFrameRect(next);
    set({ browserFrameRect: next });
  },

  orbState: "collapsed",
  setOrbState: (s) => set({ orbState: s }),

  setCommandBarFullMode: (v) => {
    persistCommandPrefs(v, get().commandBarCompactContext);
    set({ commandBarFullMode: v });
  },
  toggleCommandBarFullMode: () => {
    const v = !get().commandBarFullMode;
    persistCommandPrefs(v, get().commandBarCompactContext);
    set({ commandBarFullMode: v });
  },
  setCommandBarCompactContext: (v) => {
    persistCommandPrefs(get().commandBarFullMode, v);
    set({ commandBarCompactContext: v });
  },
  toggleCommandBarCompactContext: () => {
    const v = !get().commandBarCompactContext;
    persistCommandPrefs(get().commandBarFullMode, v);
    set({ commandBarCompactContext: v });
  },
}));
