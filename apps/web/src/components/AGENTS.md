# apps/web/src/components — AGENTS.md

## Purpose

Cross-feature **presentational** building blocks. `shell/` re-exports workspace chrome from `features/shell` until components are physically moved.

## Layout

- `shell/` — sidebar, top bar, workspace page entry
- `ui/` — primitives (stubs)
- `feedback/` — user-visible status (stubs)

## Invariants

Route-level pages and domain logic remain in `features/*`.
