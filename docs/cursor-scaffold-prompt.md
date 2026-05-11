# Cursor scaffold prompt — browser-first AI workspace

Drop into Cursor when bootstrapping or refactoring toward a **Space Agent–style** architecture: browser-first runtime, persistent spaces, disk-backed widgets, execution grammar, hierarchical `AGENTS.md`.

**Product:** AIRIS Intelligence Agent (this repo) or rename root to `operator-space/` if you prefer.

---

You are my implementation engineer. Build or refactor toward a **browser-first AI workspace**: persistent spaces, widgets on disk, chat + execution blocks, snapshots, recovery, browser transcription—not a generic chat sidebar.

## Engineering constraints

- **Frontend:** React + TypeScript + Vite  
- **State:** Zustand (or equivalent)  
- **Backend:** Node + Fastify  
- **Shared:** `packages/shared` — **Zod is source of truth**; `constants/*` must **derive** from schemas where possible (see `packages/shared/src/constants/`).  
- **Persistence:** human-readable files under `data/users/default/...`  
- **Docs:** root + subsystem `AGENTS.md`; keep contracts explicit.

## Folder shape (target)

Follow the tree in [recommended-folder-tree.md](./recommended-folder-tree.md). Prefer:

- `apps/server/src/routes/*` — HTTP only  
- `apps/server/src/services/*` or `execution/*`, `persistence/*` — business logic  
- `apps/web/src/features/*` — vertical slices (spaces, chat, widgets, browser, snapshots, recovery)  
- `packages/shared/src/schemas/*` + `constants/*` + `types/*`

## Execution pipeline (must exist)

1. User message → LLM (stream optional)  
2. Parse `<<<EXECUTION` … `>>>END`  
3. Validate allowlisted types + payloads  
4. Dispatch mutations  
5. Persist atomically  
6. Throttle mutation snapshots if needed  
7. Log execution records  
8. UI refresh

## Widget registry

- **Shared:** kind enum + payload schemas + `widget-registry.ts` (prompt hints + `parseWidgetPayload`)  
- **Web:** `features/widgets/registry.tsx` maps kind → renderer  
- **Server:** dispatcher uses shared validation—no duplicate ad hoc switches for payload shape

## First tasks

1. Ensure `packages/shared` exports `constants/*`, `schemas/common.ts`, `utils/ids.ts`.  
2. Add or align server `chat-runner` + streaming route if missing.  
3. Add recovery route that never assumes valid space JSON.  
4. Document layout invariant: **`layout.json` vs widget files** in `architecture.md`.

## Do not

- Clone third-party branding or proprietary code.  
- `eval` arbitrary model output in the host app.  
- Stuff full transient context into `chat.jsonl`.

---

After each milestone, list files touched and what remains.
