# AIRIS architecture notes

## Widget runtime

AIRIS treats widgets as **first-class persisted objects**, not ephemeral DOM. Each widget is a file-backed record validated by `@airis/shared` Zod schemas.

### Registry and renderers

- **Shared:** `WidgetKindSchema`, per-kind payload schemas, `WIDGET_KIND_DEFS`, layout defaults, dashboard recipes (`packages/shared`).
- **Web:** Trusted React renderers only (`apps/web/src/features/widgets`). The client resolves `kind` → component; arbitrary code from the model is not executed.
- **Server:** `parseWidgetPayload` on create/update; execution dispatcher persists records.

### Renderer persistence

Persistence is **kind + validated `data` + `layout` + optional `renderConfig` / `dataSource` / `authoringNote`**. Optional `renderConfig.structuredRenderId` reserves a future constrained DSL. Do not store executable JS in widget JSON.

### Live data adapters

- Widgets may declare `dataSource: { key, refreshIntervalMs? }`.
- Only **allowlisted keys** (`WELL_KNOWN_DATA_SOURCE_KEYS` and server handlers in `apps/server/src/data-source/live-data-service.ts`) resolve to patches. Secrets stay in environment or server config, not in widget files.
- The browser polls `GET /api/spaces/:spaceId/widgets/:widgetId/live-data` and merges `dataPatch` into the rendered view.

### Layout and composition

- **Spatial layout:** `layout: { x, y, w, h }` on a 12-column grid; the canvas uses `react-grid-layout` for drag/resize with debounced PATCH persistence.
- **Recipes:** Named `workspace.compose` recipes (`expandDashboardRecipe`) produce multiple blueprints (e.g. crypto dashboard). Tier-3 “composite” UIs are compositions of Tier-1/2 kinds.

### Execution model

- Structured blocks: `<<<EXECUTION` … `>>>END` (see `packages/shared/src/protocol/execution.ts`).
- A single assistant message may contain **multiple** execution blocks; they are validated and dispatched **in order** until a failure.
- Types include `widget.create`, `workspace.compose`, `widget.update`, browser actions, etc.

### Workspace browser: three surfaces (do not confuse them)

**1. Embedded panel (web UI)** — For sites that **allow** cross-origin framing, `BrowserPanel` sets the iframe **`src` to the real URL** and **remote JavaScript runs** in your desktop browser. **Google, Bing, Yelp, Facebook, X/Twitter, LinkedIn, Reddit, and many others forbid embedding** (`X-Frame-Options` / `frame-ancestors`); a direct iframe then shows a blank or broken page. For those hosts the app **automatically** loads the same-origin **`/browser/preview`** document instead (sanitized HTML / search mirrors — see `apps/web/src/features/browser/iframe-embed-policy.ts`). Use **↗** for the full live site in a normal tab.

**2. Server-side fetch / transcription (default for much of the agent pipeline)** — When execution uses **`browser.navigate` with `mode: fetch`** (common) or when tooling calls **`GET /api/spaces/:spaceId/browser/preview?url=…`**, the **Fastify server** downloads HTML and builds a **static** document: scripts removed, dangerous attributes stripped (`transcribe.ts`, `preview-html.ts`). That text snapshot is what usually feeds **LLM context**. **JavaScript from the remote site does not run on the server.** So: you can see a full JS page in the iframe while the agent’s last **fetch** snapshot is still “static HTML only.”

**3. Playwright = true headless Chromium on the server (optional)** — Set **`AIRIS_PLAYWRIGHT=1`** and install browsers once: **`npx playwright install chromium`** (from repo root is fine). Then `browser.navigate` / click / type / scroll can drive **headless Chromium** on the server, scripts run in **that** environment, and transcription can reflect a live-rendered DOM. This is the closest thing to “Chrome on the server,” not the React iframe.

**`browser.navigate` with `mode: visual`** updates the session URL (and a minimal transcription placeholder) so the **iframe** tracks the target without always doing a server HTML fetch—useful to avoid duplicate 403 noise on strict sites while still showing the live page to the operator.

**Search / thin static previews:** For server fetch, many SERPs are script-heavy; `preview-html.ts` maps some hosts (Google/Bing/Yelp-style search) to a **readable HTML mirror** (e.g. DuckDuckGo classic HTML) so the agent gets non-empty text. **Agents should still `browser.navigate` to a full results URL** (query in the URL), not narrate fake keystrokes into a search box.

**When you need a normal tab:** use **↗** in the browser bar for the system browser, or enable Playwright for server-driven automation.

AIRIS does **not** embed an unconstrained remote browsing context with an agent `_____javascript` bridge like a native-hosted “Space Agent” stack; extending toward that would be a **separate product surface** (security, process isolation, and protocol). The execution contract here stays **`<<<EXECUTION`** + allowlisted types.

### Operator path: “Space Agent–like” without turning the workspace into malware

If you want **rich replies, live web behavior, and charts on the canvas**, you get most of that by **stacking features AIRIS already has**—not by letting the model emit random JavaScript into your UI.

| Goal | What to use | Non-developer note |
|------|----------------|-------------------|
| **Charts / graphs / KPI boards** | `widget.create` → `chart-panel`; `workspace.compose` → recipe `crypto-dashboard` or a `widgets[]` layout | The model must output structured YAML inside `<<<EXECUTION` blocks; the **web app** draws charts from validated JSON—same *look*, different *mechanism* than Space Agent’s `renderWidget` JS. |
| **Search and “real” pages** | `browser.navigate` to a full results URL; optional **`AIRIS_PLAYWRIGHT=1`** + `npx playwright install chromium` | Playwright runs **headless Chromium on the server**. The **web iframe** can also show full JS if the site allows embeds—but **agent fetch snapshots** remain static HTML unless Playwright builds them. |
| **Pixel-identical Google / heavy SPAs / sites that block iframes** | **↗** open in the system browser | Full JavaScript in a normal tab; bypasses iframe and server-fetch limits. |
| **Page-level script the model wrote** | **`browser.evaluate`** + **`AIRIS_PLAYWRIGHT=1`** + **`AIRIS_PERSONAL_BROWSER_EVAL=1`** | Runs inside **headless Chromium** (same rough class as `page.evaluate`), not inside the AIRIS React app. Still risky on **localhost** / private networks — solo operator only unless you harden further. |
| **“Unconstrained” model JS in the workspace UI** | Not supported | Running LLM-written JS in the logged-in web app would be a different product. |

**Practical order of operations (copy to a checklist):**

1. Run the server with **`AIRIS_PLAYWRIGHT=1`** and install Chromium once (`npx playwright install chromium` from the repo root) so `browser.navigate` / click / type match live pages when the model uses them.
2. Use a **real** model (not only mock) so execution blocks are generated reliably; keep the system prompt’s widget registry in context.
3. Ask in natural language for **“a chart of …”** or **“a crypto-style dashboard”**—the agent is steered to **`chart-panel`** and **`workspace.compose`** (see `prompt-builder.ts`).
4. Accept that **AIRIS will not** become “model pastes `_____javascript` and it runs in-page” without a **forked** or **add-on** project that implements isolation; if that is a hard requirement, running **Space Agent** (or similar) alongside AIRIS may be simpler than forcing one codebase to be both.

### Skills integration (future)

Skills reference allowed execution types and recommended widget kinds in manifests; prompt routing can inject SKILL.md context without storing large transcripts in `chat.jsonl`.
