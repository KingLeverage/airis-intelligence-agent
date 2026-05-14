# AGENTS.md — apps/web

React 19 + Vite 6 + Tailwind 4 renderer. Displays widgets that mirror
server state. Owns no business logic, no persistence, no LLM calls — it
renders what the server tells it to render and dispatches user actions
back through the execution pipeline.

Parent contract: `/AGENTS.md` (repo root). This file extends and
overrides the root for files under `apps/web/`.

## Directory map

- `src/features/` — Feature-scoped components and widgets. Each widget
  kind (e.g. `LeadFinderWidget.tsx`) lives in its own folder or file
  under here.
- `src/stores/` — Client state stores (Zustand or similar). **Client
  state only** — UI toggles, selection, transient input. Persisted
  state is server state and lives on the server.
- `vite.config.ts` — Build config. Must bind dev server to
  `127.0.0.1:5173` (see "Toolchain invariants" below).

## The renderer-only rule

The web app does three things:

1. Render widgets from server state.
2. Capture user input and turn it into HTTP requests to the server.
3. Display real-time updates (chat tokens, scrape progress) streamed
   from the server.

If you find yourself writing scraping logic, prompt building, lead
parsing, persistence, or anything that resembles "business rules" —
stop. That goes in `apps/server/`. The web app is a view layer.

## Widget rendering contract

Every widget kind:

1. Has a Zod schema defined in `@airis/shared` (`WidgetRecord` and a
   per-kind `data` schema).
2. Has a renderer component under `src/features/` whose props match
   the parsed server record.
3. Reads its data from the server-provided widget record — never
   re-fetches or re-derives state the server already owns.
4. Issues mutations by dispatching execution requests to the server,
   not by mutating local state and "syncing later."

Mutations follow this pattern:

```ts
// Wrong: mutate locally then POST
setWidgetLayout(newLayout);
await api.updateLayout(newLayout); // server is now the lagging copy

// Right: dispatch, let server state flow back
await api.dispatchExecution({
  type: "layout.update",
  payload: { widgetId, layout: newLayout },
});
// server pushes updated state; renderer reacts
```

The server is the source of truth. The renderer is a projection.

## Adding a new widget kind

1. Schema: confirm a `WidgetData<MyKind>` Zod schema exists in
   `@airis/shared`. If not, add it there first — never define the
   schema in `apps/web/`.
2. Component: create `src/features/<area>/MyKindWidget.tsx`. Props
   should be `{ widget: WidgetRecord<"my-kind"> }` or similar — typed
   from the shared schema, not duplicated.
3. Registry: wire the new kind into whatever widget dispatcher maps
   `widget.kind` → component. Keep this registry centralized; do not
   inline `switch (kind)` in random places.
4. Mutations: any user action that changes persisted state dispatches
   an execution via the existing API client. Do not add a one-off
   REST endpoint for the new widget; use the dispatcher.
5. Layout: do not hardcode `x`/`y`/`w`/`h`. The server's
   `defaultLayoutForKind` + `nudgeLayoutBelowConflicts` (in
   `@airis/shared`) own layout placement. Renderer respects what the
   server returns.

## State management

- **Server state** (widgets, spaces, chat history, layout, settings,
  instructions) — lives on the server, fetched/streamed to the
  renderer, never mutated locally without round-tripping.
- **Client state** (which panel is open, selection, in-progress text
  input, modal visibility) — lives in `src/stores/`. Never persisted.
- **URL state** (current space ID, active widget) — encoded in the URL
  where reasonable so refresh restores context.

If you can't decide whether something is client or server state, ask:
"does this survive a page reload?" If yes, server. If no, client.

## Styling

- Tailwind 4. No CSS modules, no styled-components, no `.scss`.
- Use Tailwind utility classes inline. Extract a component (not a
  class) when a pattern repeats more than twice.
- Dark mode is the default and only theme right now. Don't scaffold a
  theme switcher speculatively.

## Toolchain invariants

- React 19 — function components only, no class components, hooks for
  state.
- Vite 6 dev server **must** bind to `127.0.0.1:5173`. macOS resolves
  `localhost` to `::1` and Electron's loader fails silently against an
  IPv6-only Vite. The `vite.config.ts` `server.host` setting must
  remain `"127.0.0.1"`. Do not "fix" this back to `localhost` or
  `0.0.0.0`.
- TypeScript strict. Run `npm run typecheck -w @airis/web` before
  committing.
- ESM only — `"type": "module"` in `package.json`. No CommonJS.

## Communication with the server

- HTTP requests go through a single typed API client (do not scatter
  `fetch` calls across components).
- Streaming responses (chat tokens, scrape progress) use the
  server-provided streaming endpoint. Render incrementally — do not
  buffer the entire stream before painting.
- Errors from the server return as `{ ok: false, code, message }`.
  Render the message; do not throw inside components.

## Communication with the desktop (Electron)

The renderer talks to the BrowserView via the bridge exposed by
`apps/desktop/preload.cjs` (e.g. `window.airisNativeBrowser`). Rules:

- Only call exposed bridge functions; never assume
  `window.require("electron")` exists (it doesn't — `nodeIntegration`
  is off).
- Treat the bridge as optional. The web app must render correctly when
  running in a plain browser (`window.airisNativeBrowser === undefined`).
  Feature-detect and degrade gracefully.
- Bounds management for the BrowserView panel: when a panel mounts,
  call `setBounds` with the panel's actual rect; when it unmounts,
  pass a sentinel large rect, **not** `{0,0,0,0}`. The desktop main
  process guards against zero sizes, but the renderer shouldn't rely
  on that guard.

## Testing and verification before commit

1. `npm run typecheck -w @airis/web` — must pass.
2. `npm run lint -w @airis/web` — must pass.
3. `npm run build -w @airis/web` — must succeed. A renderer that
   typechecks but fails to build is broken.
4. Visual check: load the app in the Electron shell and confirm the
   touched widget renders correctly with real server state. Do not
   ship UI changes verified only against mocked data.

## Things that have bitten us (web-side)

- Vite bound to `localhost` instead of `127.0.0.1` → blank white
  screen in Electron on macOS, no error message. Always `127.0.0.1`.
- Mutating widget state locally before the server confirms → UI shows
  one thing, server has another, refresh "loses" the change. Always
  round-trip through the dispatcher.
- Defining widget data schemas in `apps/web/` instead of
  `@airis/shared` → server and renderer drift apart, runtime
  validation fails on the server side. Schema lives in shared.
- A panel unmount handler calling `setBounds({0,0,0,0})` on the
  BrowserView → Chromium hides the view, scraping breaks. Use a
  sentinel offscreen rect with real dimensions, or simply don't
  resize on unmount.

## Out of scope here

- A mobile/responsive layout (desktop-only target).
- Multi-theme support (dark only).
- A plugin/extension UI for skills (planned, but no UI scaffolding
  until the SKILL.md loader lands on the server).
- Client-side caching beyond what the API client already does. The
  server is fast enough; don't add a cache layer speculatively.

Do not scaffold these.
