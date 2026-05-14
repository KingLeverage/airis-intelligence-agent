# AGENTS.md — apps/desktop

Electron shell. Hosts the React renderer and exposes a hidden Chromium
`BrowserView` for server-driven web automation (Google Maps scraping,
extraction, navigation). This app is intentionally thin — it owns no
business logic, only the window, the BrowserView, and the IPC surface
between them and the server.

Parent contract: `/AGENTS.md` (repo root). This file extends and
overrides the root for files under `apps/desktop/`.

## Directory map

- `main.cjs` — Electron main process. Window creation, BrowserView
  lifecycle, all `airis:native-browser:*` IPC handlers. **CommonJS by
  design** (Electron main bootstrap); this is the only `.cjs` file you
  should see in the repo.
- `preload.cjs` — Preload script. Bridges `ipcRenderer` to the renderer
  via `contextBridge`. Whitelist-only — never expose raw `ipcRenderer`.
- `dev-desktop.mjs` (if present) — dev launcher that waits on Vite,
  then spawns Electron.

## The thin-shell rule

The desktop app does three things and nothing else:

1. Show a `BrowserWindow` that loads the Vite dev server (or built
   bundle) in renderer.
2. Own a single persistent `BrowserView` (`workspaceBrowserView`) for
   web automation, kept inside the window's drawable region so Chromium
   treats it as visible.
3. Expose `airis:native-browser:*` IPC handlers that the server calls
   (via the renderer as a relay) to drive that BrowserView.

If you find yourself adding business logic, scraping selectors, lead
parsing, or prompt-related code here — stop. That goes in
`apps/server/`. The desktop only ferries bytes.

## BrowserView lifecycle (the rules that took a week to learn)

### Rule 1: Visibility requires layout inside the window

A `BrowserView` positioned outside the parent window's drawable region
(e.g. `x: -10000`) makes Chromium report
`document.visibilityState === "hidden"` and freezes layout at 0×0.
`window.innerWidth` / `innerHeight` will read 0, `clientHeight` will be
0, and pages like Google Maps will not virtualize their result lists.
**Scraping is impossible in this state.**

Required behavior in `ensureBrowserViewReadyForNativeIpc`:

```js
const winBounds = mainWindow.getContentBounds();
const desiredWidth  = Math.min(1280, Math.max(800, winBounds.width));
const desiredHeight = Math.min(900,  Math.max(600, winBounds.height));
const b = bv.getBounds();
const needsResize = b.width < 800 || b.height < 600 || b.x < 0 || b.y < 0;
if (needsResize) {
  bv.setBounds({ x: 0, y: 0, width: desiredWidth, height: desiredHeight });
}
try { bv.webContents.setBackgroundThrottling(false); } catch { /* older Electron */ }
```

The view sits at `(0,0)` inside the window. The React UI is rendered on
top of it via z-ordering in the renderer; the BrowserView is **behind**
the UI, not off-screen. Off-screen breaks Chromium. Do not "optimize"
this back to negative coordinates.

### Rule 2: `setBackgroundThrottling(false)` is required

Chromium aggressively throttles JS in non-foreground views. Without
disabling it, Maps' scroll loop runs at ~1 Hz and the harvest phase
times out with zero cards. Always disable it after attaching the view.

### Rule 3: `ensureBrowserViewReadyForNativeIpc` is the single entry point

Every IPC handler that touches the BrowserView **must** start with:

```js
const bv = await ensureBrowserViewReadyForNativeIpc();
if (!bv) return { ok: false, code: "no_browser_view" };
```

This function guarantees: view exists, view is attached to the window,
view has usable bounds, `about:blank` has loaded so
`executeJavaScript` has a real document, and background throttling is
off. Do not call `setBrowserView`, `setBounds`, or `loadURL` directly
from handlers — go through this function.

The "user-sized" branch (`__airisViewWasUserSized`) exists to preserve
user-controlled bounds when the browser panel is mounted in the UI. The
size-clamp above runs **regardless** of that flag — a panel mounted at
1×1 would still break scraping.

### Rule 4: Bounds-setter IPC must guard against zero sizes

The renderer's panel mount/unmount lifecycle can race and call
`airis:native-browser:setBounds` with `{0,0,0,0}`. Guard:

```js
ipcMain.handle("airis:native-browser:setBounds", (_e, bounds) => {
  const bv = workspaceBrowserView;
  if (!bv) return;
  if (!bounds || bounds.width < 100 || bounds.height < 100) {
    bv.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
    return;
  }
  bv.setBounds(bounds);
});
```

Never accept caller bounds blindly.

## IPC surface

All native-browser IPC lives under the `airis:native-browser:*`
namespace. Current handlers (keep this list current):

- `airis:native-browser:setBounds` — renderer tells main where to place
  the view inside the window.
- `airis:native-browser:loadUrl` — navigate the view. Validates URL via
  `isAllowedHttpUrl`.
- `airis:native-browser:back` — history back if possible.
- `airis:native-browser:getCurrentUrl` — current URL or empty string.
- `airis:native-browser:evaluate` — `executeJavaScript` with a timeout.
- `airis:native-browser:extractText` — bounded text extraction with a
  truncation marker.
- `airis:native-browser:extractHtml` — bounded HTML extraction with a
  truncation marker.
- `airis:native-browser:scrollWheel` — synthetic scroll input with
  configurable steps and delay.

Rules for adding a new handler:

1. Name must start with `airis:native-browser:`.
2. First line: `const bv = await ensureBrowserViewReadyForNativeIpc()`
   plus the null-guard.
3. Validate every argument. Reject silently with
   `{ ok: false, code: "..." }` rather than throwing across IPC.
4. Wrap any `webContents.*` call in `try/catch` — the view can be
   destroyed mid-operation.
5. Whitelist the new channel in `preload.cjs`. **Never** widen the
   preload bridge to expose raw `ipcRenderer`.
6. Document the handler in this file's IPC list.

## Preload contract

`preload.cjs` uses `contextBridge.exposeInMainWorld` to expose a single
namespaced object (e.g. `window.airisNativeBrowser`) with one function
per whitelisted IPC channel. Rules:

- **No raw `ipcRenderer`** in the renderer. Ever.
- Every exposed function maps 1:1 to a single
  `ipcMain.handle`/`ipcMain.on` channel.
- Type-check arguments client-side before invoking — the main process
  validates again, but defense in depth.
- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
  on the BrowserView. These are set in `ensureWorkspaceBrowserView` and
  must not be relaxed.

## Window and view configuration

The BrowserView uses a dedicated persisted partition:

```js
partition: "persist:airis-workspace-browser"
```

This isolates cookies/storage from the main app and from any other
view. Do not share partitions across views. Do not switch to
non-persistent storage — Maps consent banners and login state must
survive restarts.

`setWindowOpenHandler` is wired so `target=_blank` / `window.open()`
links load inside the same BrowserView rather than spawning a floating
`BrowserWindow`. Do not remove this — Notion, Maps, and others rely on
it to keep navigation contained.

## Dev workflow specifics

- Launch: `npm run dev:desktop` from repo root.
- Logs: `/tmp/airis-desktop.log`. May contain binary bytes — **always**
  use `grep -a`.
- Vite must be reachable at `http://127.0.0.1:5173` (not `localhost`).
  macOS resolves `localhost` to `::1` and Electron's loader fails
  silently. The Vite config in `apps/web/` binds to IPv4 — do not
  revert this.
- Clean restart when something is wedged:
  ```
  pkill -9 -f "@airis"; pkill -9 -f "tsx watch"; pkill -9 -f "vite"
  pkill -9 -f "electron apps/desktop"
  sleep 2
  rm -f /tmp/airis-desktop.log
  npm run dev:desktop 2>&1 | tee /tmp/airis-desktop.log
  ```
  Do **not** `pkill -9 -f electron` unscoped — it kills VS Code,
  Slack, and every other Electron app on the machine.

## Diagnosing scraping failures

When a lead-finder run returns `businessCount: 0`, work this checklist
in order:

1. Confirm the view is attached and sized:
   ```
   grep -a "ensureBrowserViewReadyForNativeIpc diag" /tmp/airis-desktop.log | tail -5
   ```
   `finalBounds` should be inside the window; `winVisible` true;
   `isAttached` true.

2. Confirm Chromium sees the view as visible:
   ```
   grep -a "viewport probe" /tmp/airis-desktop.log | tail -5
   ```
   `vis` must be `"visible"`. `iw` and `ih` must match the requested
   bounds. If `vis: "hidden"`, the view is outside the window — go fix
   the bounds.

3. Confirm scroll is actually moving:
   ```
   grep -aE "maps\.scroll diag" /tmp/airis-desktop.log | tail -20
   ```
   `clientHeight` ≈ 900, `scrollTopAfter` strictly increasing,
   `cardCount` strictly increasing.

4. If the page loads but Maps shows zero results, check for consent
   banners or captchas — the partition persists state, so once cleared
   the issue stays fixed.

The viewport-probe and `ensureBrowserViewReadyForNativeIpc diag`
`console.log`s are diagnostic-only. Remove them after a successful
debug cycle; do not leave them in committed code permanently.

## Things that have bitten us (do not repeat)

- `setBounds({ x: -10000, ... })` to "hide" the view → Chromium reports
  `visibilityState: "hidden"` → `clientHeight: 0` → zero leads. The
  view must live inside the window.
- `setBounds({ x: 0, y: 0, width: 1, height: 1 })` as a default →
  same problem. 1×1 is not "small enough to ignore," it is "Chromium
  refuses to lay it out."
- Forgetting `setBackgroundThrottling(false)` → scroll loop runs at
  ~1 Hz under background throttling, harvest sees 1 card.
- Renderer panel unmount calling `setBounds({0,0,0,0})` mid-scrape →
  guard the IPC handler, do not trust caller bounds.
- `grep` on `/tmp/airis-desktop.log` without `-a` returns nothing
  because the file contains binary bytes. Always `grep -a`.
- Binding Vite to `localhost` → Electron loads white screen on macOS.
  Bind to `127.0.0.1`.
- `pkill -9 -f electron` (unscoped) → kills VS Code/Slack/etc.
  Use `pkill -9 -f "electron apps/desktop"`.

## Out of scope here

- Multi-window UX (single main window for now).
- Headless mode without a window (`BrowserView` requires a parent
  window to be visible to Chromium).
- A Playwright fallback for scraping — the BrowserView path works;
  don't add a second scraping stack.

Do not scaffold these speculatively.
