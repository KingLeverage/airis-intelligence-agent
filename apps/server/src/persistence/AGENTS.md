# persistence — AGENTS.md

## Purpose

Filesystem layout helpers, atomic writes, and space CRUD I/O for AIRIS.

## Key files

- `paths.ts` — resolves `data/users/...` tree
- `fs-utils.ts` — `atomicWriteJson`, `appendJsonl`, `readJsonWithSchema`
- `space-store.ts` — spaces, widgets, layout, chat, settings, instructions

## Invariants

- Always `safeParse` when loading user data; never throw on corrupt widget files at list boundaries (recovery route drills deeper).

## Extension points

- New persisted artifact = new path helper + store function + Zod schema in `@airis/shared`.
