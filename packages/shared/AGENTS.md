# packages/shared — AGENTS.md

## Purpose

Single source of truth for **Zod schemas** and **TypeScript types** used by `apps/web` and `apps/server`.

## Key files

- `src/schemas/common.ts` — shared Zod primitives (`UuidIdSchema`, `EntityMetaSchema`, …)
- `src/constants/*` — **derived** lists (`WIDGET_KINDS`, `EXECUTION_TYPES`) — do not hand-edit separately from Zod
- `src/schemas/*.ts` — domain validation
- `src/widget-registry.ts` — per-kind payload schemas + prompt snippets (`WIDGET_KIND_DEFS`); startup asserts registry completeness on server
- `src/protocol/execution.ts` — EXECUTION block types and allowlists
- `src/utils/ids.ts` — `newUuid()` for clients + Node
- `src/types/protocol.ts` — re-exports of protocol TS types
- `src/index.ts` — re-exports

See also [docs/recommended-folder-tree.md](../../docs/recommended-folder-tree.md) for a target monorepo layout.

## Invariants

- Every persisted entity has a matching schema; use `safeParse` at IO boundaries.
- Execution `type` literals MUST stay in sync with server dispatcher and prompt docs.

## Extension points

Add new schema files and export from `index.ts`. Prefer small focused modules over one giant file.

## Do not break

- `WidgetKindSchema` values are referenced by the web widget registry.
- JSON field names in snapshots and API bodies are stable once shipped.
