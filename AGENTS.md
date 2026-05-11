# AIRIS Intelligence Agent — root AGENTS.md

## Purpose

Monorepo for **AIRIS Intelligence Agent**: a browser-first operator workspace with a thin Fastify API, shared Zod schemas, and file-based persistence.

## Layout

| Path | Role |
|------|------|
| `apps/web` | Vite + React + TypeScript + Tailwind + Zustand |
| `apps/server` | Fastify REST API, LLM proxy, persistence, execution pipeline |
| `apps/desktop` | Optional **Electron** shell: native `BrowserView` over the workspace browser (IPC from `BrowserPanel` when `window.airisNativeShell` is present). Run `npm run dev:desktop`. Window is **always-on-top** by default; set `AIRIS_ELECTRON_ALWAYS_ON_TOP=0` to disable. |
| `packages/shared` | Zod schemas and inferred types — **single source of truth** |

## Widget runtime (first-class subsystem)

- Widgets are **typed, file-persisted records** (`WidgetRecord`): `kind`, `data`, `layout`, optional `renderConfig`, `dataSource`, `authoringNote`.
- **Renderers are trusted registry components** in `apps/web` — no `eval` of model-supplied code. Persistence = schema + data + layout metadata.
- **Live data:** `dataSource.key` references **server-allowlisted** adapters only (`WELL_KNOWN_DATA_SOURCE_KEYS` + `live-data-service`). Secrets never belong in widget JSON.
- **Workspace UI:** `WorkspaceCanvas` uses a draggable grid; layout changes persist via widget PATCH.
- **Multi-widget / multi-action:** The model may emit **multiple** `<<<EXECUTION` blocks per reply; the server dispatches them in order (see `parseModelResponseMulti`, `chat-runner`).
- See **`architecture.md`** for the full widget-runtime section.

## Workspace browser

Three surfaces: **(1)** The web **iframe** loads the real URL in the **operator’s** browser—remote JS runs there if the site allows embedding. **(1b)** **`apps/desktop` + `npm run dev:desktop`:** Electron embeds a native **`BrowserView`** (real Chromium, real origins) over the browser panel via preload IPC—closest to “Space Agent–style” in-app browsing without replacing the whole web stack. **(2)** **Server-side** `browser.navigate` **fetch** mode and **`/browser/preview`** fetch HTML and strip scripts for **static transcription** (no remote JS on the server). **(3)** **`AIRIS_PLAYWRIGHT=1`** + **`npx playwright install chromium`** runs **headless Chromium on the server** for real DOM automation and live-rendered snapshots. Optional **`browser.evaluate`** (`AIRIS_PERSONAL_BROWSER_EVAL=1` + Playwright) runs model script in that headless page—not in the React shell. Details: **`architecture.md`**, **`apps/server/AGENTS.md`**. **Search / SPAs:** `browser.navigate` to a **full results URL** where needed.

## Invariants

1. All entities read from disk MUST be validated with Zod (`safeParse`); corrupt files must not crash the recovery UI.
2. Execution only accepts allowlisted `type` values defined in `packages/shared`.
3. Per-widget `layout` is stored on each widget file; aggregate `layout.json` may exist for legacy/overlays — widget layout is authoritative for the canvas grid.
4. Transient LLM context (widget summaries, browser transcription) is composed per request — not stored wholesale in `chat.jsonl`.

## Extension points

- **New widget kind:** Add kind to `WidgetKindSchema`, payload schema, registry in `apps/web/src/features/widgets`, and dispatcher branch in `apps/server/src/execution/dispatcher.ts`.
- **New LLM provider:** Implement adapter in `apps/server/src/llm/` and wire in `respond.ts`.

## Do not break

- Shared package exports consumed by both apps.
- REST paths documented in `apps/server/AGENTS.md`.
- `<<<EXECUTION` … `>>>END` protocol contract in `packages/shared/src/protocol/execution.ts`.
