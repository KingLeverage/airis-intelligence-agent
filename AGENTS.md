# AGENTS.md — AIRIS Intelligence Agent (root)

This file is the contract every coding agent reads before touching this repo.
Subsystem rules live in `apps/<area>/AGENTS.md`. When those conflict with this
file, the subsystem doc wins for files inside that area.

## What AIRIS is

A desktop intelligence workspace. Electron hosts a hidden Chromium
`BrowserView` for headless web automation (Google Maps scraping, etc.); a
Fastify server owns all business logic, persistence, and LLM orchestration; a
React renderer displays widgets that mirror server state.

The agent's job is to read user intent, emit `<<<EXECUTION>>>` blocks, and let
the server mutate the workspace. The agent never mutates UI state directly.

## Architecture rule (read this first)

**Server-first.** Logic, validation, persistence, and side effects live in
`apps/server`. The web app renders server state and dispatches executions. The
desktop app is a thin shell that hosts the renderer and exposes Chromium IPC.

If you are tempted to put business logic in `apps/web` or `apps/desktop`, stop
and put it in `apps/server` instead.

## Monorepo layout

- `apps/server` — Fastify server. Owns dispatcher, persistence, LLM prompt
  building, lead-finder runner, browser routes. Single source of truth.
- `apps/web` — React 19 + Vite 6 + Tailwind 4 renderer. Widgets only.
- `apps/desktop` — Electron main process (`main.cjs`) + preload. Hosts a
  `BrowserView` for native automation and exposes it over IPC.
- `packages/shared` — Zod schemas, widget layout helpers, types shared across
  server/web/desktop. The only package both runtimes import.

## The execution contract

The LLM emits fenced blocks of the form:

    <<<EXECUTION>>>
    { "type": "widget.create", "payload": { ... } }
    <<</EXECUTION>>>

Every execution type is:

1. Declared as a Zod schema in `@airis/shared`.
2. Handled by a `case` in `apps/server/src/execution/dispatcher.ts`.
3. Documented as a prompt fragment in `apps/server/src/llm/prompt-builder.ts`.

If any of those three are missing, the capability does not exist. Adding a
capability means touching all three — no exceptions.

Current execution types include: `widget.create`, `widget.createMany`,
`widget.update`, `widget.move`, `widget.resize`, `widget.delete`,
`layout.update`, `workspace.compose`, `browser.{navigate,back,click,type,scroll,evaluate}`,
`space.{create,delete}`, `snapshot.create`, `cli.tool.run`, `export.pdf`,
`workflow.run`, `lead-finder.*`.

## Persistence model

File-backed JSON tree under the user data dir, mediated by
`apps/server/src/persistence/space-store.ts`. Rules:

- All writes go through `atomicWriteJson` / `appendJsonl` in `fs-utils.ts`.
- All reads go through `readJsonWithSchema` and **always** `safeParse` — never
  throw on a corrupt widget file; log and skip.
- A new persisted artifact requires: a path helper in `paths.ts`, a store
  function in `space-store.ts`, and a Zod schema in `@airis/shared`.
- There is no per-user override layer (yet). One user, one data tree.

## Widget layout

New widgets must not stack on top of existing ones. Use the helpers in
`@airis/shared`:

```ts
import { defaultLayoutForKind, nudgeLayoutBelowConflicts } from "@airis/shared";

const base = defaultLayoutForKind("lead-finder");
const desired = { ...base, h: heightForRows(rows.length) };
const existing = await store.listWidgetRecords(spaceId, userId);
const layout = nudgeLayoutBelowConflicts(desired, existing);
```

The dispatcher already does this for `widget.create`. Any runner that calls
`createWidgetForSpace` directly (e.g. `lead-finder-runner.ts`) must do it too.
Re-runs that call `updateWidgetForSpace` must **not** nudge — user layout is
preserved on re-run.

## Dev workflow

- Start everything: `npm run dev:desktop` from repo root. Logs to
  `/tmp/airis-desktop.log`.
- Vite must bind to `127.0.0.1:5173` (not `localhost`) so Electron's IPv4
  loader connects. Do not revert this.
- Inspect scraping runs:
  `grep -aE "maps\.scroll diag|maps\.harvest|workflow\.run complete" /tmp/airis-desktop.log | tail -40`
- Logs may contain binary bytes — always use `grep -a`.
- Clean restart pattern:
  ```
  pkill -9 -f "@airis"; pkill -9 -f "tsx watch"; pkill -9 -f "vite"
  pkill -9 -f "electron apps/desktop"
  sleep 2
  rm -f /tmp/airis-desktop.log
  npm run dev:desktop 2>&1 | tee /tmp/airis-desktop.log
  ```

## Toolchain invariants

- Node `>=20`, ES modules everywhere. No CommonJS in `apps/server` or
  `apps/web`. `apps/desktop/main.cjs` is the deliberate exception (Electron
  main).
- TypeScript strict. Run `npm run typecheck -w @airis/server` (and the
  equivalent for other workspaces) before committing.
- Zod is the only runtime validator. Do not introduce ajv, yup, joi, etc.
- Fastify 5 on the server. React 19 + Tailwind 4 on the web. Playwright is
  available but the lead-finder uses the Electron `BrowserView` path, not
  Playwright — keep it that way unless a feature genuinely needs Playwright.

## Checklist: adding a new capability

1. Define the payload schema in `packages/shared/src/...` and export it.
2. Add a `case` in `apps/server/src/execution/dispatcher.ts` that parses with
   the schema and calls a service.
3. Put the actual work in `apps/server/src/services/<area>/...`, never inline
   in the dispatcher.
4. Add a prompt fragment in `apps/server/src/llm/prompt-builder.ts` so the LLM
   knows the execution type exists, with at least one example.
5. If the capability persists data, add a path helper + store function.
6. If the capability renders, add a widget kind in `apps/web/src/features/...`
   that reads from server state.
7. Update the relevant subsystem `AGENTS.md`.

## Things that have bitten us (do not repeat)

- A `BrowserView` positioned at `x: -10000` makes Chromium report
  `visibilityState: "hidden"` and freezes layout at 0×0. Keep the view inside
  the parent window's drawable region. See `apps/desktop/AGENTS.md`.
- Vite bound to `localhost` resolves to `::1` on macOS and Electron's loader
  fails silently. Bind to `127.0.0.1`.
- Widget runners that bypass the dispatcher must still call
  `nudgeLayoutBelowConflicts`, or new widgets stack at (0,0).
- `grep` without `-a` on `/tmp/airis-desktop.log` silently treats the file as
  binary and prints nothing.

## Out of scope right now

- Multi-user / auth (single user, default ID in `dispatcher.ts`).
- Plugin API / dynamic skill loading (planned — see roadmap).
- Per-user or per-space prompt overrides.

Treat these as deliberate omissions, not missing features. Do not add scaffolding
for them speculatively.
