# apps/web — AGENTS.md

## Purpose

Vite + React client for **AIRIS Intelligence Agent**: operator workspace shell, canvas, chat, browser panel, recovery link.

## Key files

- `src/features/shell/*` — layout, sidebar, top bar
- `src/features/canvas/WorkspaceCanvas.tsx` — CSS grid from persisted `widget.layout`; widget load warnings banner
- `src/features/widgets/registry.tsx` — UI map per `WidgetKind` (keep in sync with `@airis/shared` registry)
- `src/features/widgets/WidgetViews.tsx` — trusted renderers per kind
- `src/features/chat/ChatPanel.tsx` — messages + execution log
- `src/features/browser/BrowserPanel.tsx` — **live iframe** when the site allows embeds; **automatic `/browser/preview`** for hosts that block framing (Google, Bing, Yelp, …) — see `iframe-embed-policy.ts`
- `src/lib/api.ts` — fetch client (`/api` proxied in dev)
- `src/stores/session-store.ts` — chat, model, theme, streaming (workspace data in `spaces-store` + `widgets-store`); after `browser.*` execution it opens the **in-app** browser panel only — **no** automatic `window.open` to the system browser (user uses **↗** in `BrowserPanel` when they want Comet/Chrome).
- `src/stores/spaces-store.ts` — space list, selection, CRUD via API
- `src/stores/widgets-store.ts` — bundle slice: widgets, layout aggregate, load warnings, note widget actions

## Invariants

- Widget rendering is **registry-only**; do not eval remote code.
- API paths mirror `apps/server` routes.

## Extension points

- New widget kind: add view in `WidgetViews.tsx` and kinds in shared schema.

## Do not break

- Vite proxy target `8787` should match server port.
