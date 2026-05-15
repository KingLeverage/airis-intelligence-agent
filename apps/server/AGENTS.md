# AGENTS.md — apps/server

Fastify server. Owns the dispatcher, persistence, LLM orchestration, browser
automation routes, and all business logic. If logic doesn't live here, it's
in the wrong place — move it.

Parent contract: `/AGENTS.md` (repo root). This file extends and overrides
the root for files under `apps/server/`.

## Directory map

- `src/server.ts` — Fastify bootstrap, route registration, lifecycle.
- `src/routes/` — HTTP endpoints. Thin: parse → call service → return.
  Examples: `lead-finder.ts`, `browser.ts`.
- `src/execution/` — The dispatcher. Single mutation entry point for
  everything the LLM emits. `dispatcher.ts` is the switch over execution
  types.
- `src/services/` — Business logic. Facades over `persistence/`,
  `execution/`, `llm/`, `browser/`, `snapshots/`. **Facades must not add
  business logic** — they re-export and compose.
- `src/persistence/` — Filesystem I/O. `paths.ts`, `fs-utils.ts`,
  `space-store.ts`. See "Persistence rules" below.
- `src/llm/` — Prompt building and adapter abstraction.
  `prompt-builder.ts` is the source of truth for what the LLM knows how to do.
  `adapters/` holds provider-specific clients (currently `mock-adapter.ts`).
- `src/agents/` — Higher-level agent loops (multi-turn orchestration).
- `src/data-source/` — External data fetchers (separate from `browser/`
  which is for live page automation).
- `src/skills/` — SKILL.md loader and routing. `skill-discovery.ts` scans
  the repo-root `skills/` tree at chat time; `skill-router.ts` does
  deterministic per-message routing (pinned → mention → trigger → tag,
  max 5 active skills); `active-skill-context.ts` budgets and formats
  the active SKILL.md bodies for injection. `chat-skill-prompt.ts` is
  the integration point — `composeSystemPromptWithSkills` is what
  routes/chat.ts and llm/respond.ts call. The `skills/` directory at
  the repo root is the **source of truth** for skill content; add new
  capabilities as `skills/<id>/skill.json` + `SKILL.md` rather than
  hardcoding into `prompt-builder.ts`.

## The dispatcher is sacred

`src/execution/dispatcher.ts` is the **only** function allowed to mutate
persisted workspace state from an LLM-driven request. Routes may call it;
services may call it; nothing bypasses it for LLM-originated mutations.

Shape of every case:

```ts
case "widget.create": {
  const payload = WidgetCreatePayload.safeParse(execution.payload);
  if (!payload.success) return { ok: false, code: "invalid_payload", ... };
  // call into services/, never inline the work here
  return await createWidgetForSpace(spaceId, payload.data, userId);
}
```

Rules:

1. Every case **must** `safeParse` with a Zod schema from `@airis/shared`.
   Never trust `execution.payload`.
2. The case body should be ~5–15 lines: parse, delegate, return. Real work
   lives in `services/`.
3. Return a `DispatchResult` discriminated union. Never throw out of the
   dispatcher — catch and return `{ ok: false, code, message }`.
4. New execution types require the three-file rule from root AGENTS.md:
   schema in `@airis/shared` + case here + prompt fragment in
   `prompt-builder.ts`.

## Adding a new execution type (mechanical recipe)

1. **Schema** — `packages/shared/src/executions/<type>.ts`:
   ```ts
   export const MyThingPayload = z.object({ ... });
   export type MyThingPayload = z.infer<typeof MyThingPayload>;
   ```
   Re-export from `packages/shared/src/index.ts`.

2. **Service** — `apps/server/src/services/<area>/my-thing.ts`. This is
   where the real work goes. Returns a typed result.

3. **Dispatcher case** — add to the switch in `dispatcher.ts`. Parse,
   delegate, return.

4. **Prompt fragment** — add a section to `prompt-builder.ts` describing
   the execution type with at least one realistic example. The LLM cannot
   emit what it hasn't been told about.

5. **Persistence (if needed)** — path helper in `persistence/paths.ts`,
   store function in `persistence/space-store.ts`, schema in
   `@airis/shared`.

6. **Types** — `npm run typecheck -w @airis/server` must pass before
   committing.

## Services layer

Services are **façades**. They orchestrate calls into `persistence/`,
`execution/`, `llm/`, `browser/`. They do not contain inline business
logic that should live in those lower layers.

Allowed in a service:
- Composing multiple persistence calls into a transaction-like sequence.
- Calling an LLM adapter and post-processing the result.
- Driving the BrowserView through `browser/` helpers.
- Validating user-facing preconditions before delegating.

Not allowed in a service:
- Direct `fs` calls (use `persistence/fs-utils.ts`).
- Inline Zod schema definitions (define in `@airis/shared`).
- LLM provider details (use `llm/adapters/`).
- Mutating persisted state outside the dispatcher path for LLM requests.

## Persistence rules

All persisted state lives under the user data directory, structured by
`persistence/paths.ts`. The store is the only module that touches the
filesystem.

Hard rules:

- **Writes** go through `atomicWriteJson` (single-object files) or
  `appendJsonl` (append-only logs). Never `fs.writeFile` a JSON blob
  directly.
- **Reads** go through `readJsonWithSchema(path, Schema)`. This calls
  `safeParse` internally. On failure: log, return `null` or skip the
  record, **never throw**. A corrupt widget file must not crash the space.
- **New artifact** = new path helper in `paths.ts` + new store function in
  `space-store.ts` + new Zod schema in `@airis/shared`. All three.
- **No migrations layer yet.** If a schema changes, the store function
  must tolerate both shapes via `safeParse` fallback. Add a TODO comment
  and we'll formalize migrations later.

## LLM and prompt building

`prompt-builder.ts` is currently the monolithic source of every prompt
fragment the LLM sees. Until the SKILL.md loader lands:

- New execution types **must** add a fragment here, or the LLM won't know
  they exist.
- Keep fragments terse and example-driven. One realistic
  `<<<EXECUTION>>>` block beats three paragraphs of prose.
- Don't add prompt fragments for capabilities that don't exist in the
  dispatcher. The prompt and the dispatcher must stay in lockstep.

When the SKILL.md loader lands, most of this file will be extracted into
`src/skills/<name>/SKILL.md` folders. Write new fragments in a way that
will port cleanly: self-contained sections with a clear trigger
condition.

## Routes

Routes in `src/routes/` are thin HTTP adapters. Pattern:

```ts
fastify.post("/lead-finder/run", async (req, reply) => {
  const parsed = LeadFinderRunRequest.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid" });
  const result = await runLeadFinderForSpace(parsed.data);
  return reply.send(result);
});
```

Routes do not contain business logic. If a route is more than ~20 lines,
the work belongs in a service.

## Browser automation (server-side)

The lead-finder and any future scraper drives the desktop's `BrowserView`
over IPC, not Playwright. See `apps/desktop/AGENTS.md` for the IPC
contract and the viewport gotchas.

Server-side rules:

- All Maps/web scraping goes through the `airis:native-browser:*` IPC
  surface, surfaced server-side via `services/browser/` helpers.
- Playwright is installed but reserved for cases the BrowserView path
  genuinely cannot handle (e.g. multi-tab orchestration). Default to the
  BrowserView.
- Scrape runners (e.g. `lead-finder-runner.ts`) that create widgets
  directly **must** call `nudgeLayoutBelowConflicts` from `@airis/shared`
  before persisting layout. Re-runs via `updateWidgetForSpace` must not.

## Testing and verification before commit

1. `npm run typecheck -w @airis/server` — must pass.
2. `npm run lint -w @airis/server` — must pass.
3. For dispatcher changes: trigger the new execution type end-to-end via
   the desktop app and confirm in `/tmp/airis-desktop.log`:
   `grep -aE "<execution-type>|workflow\.run complete" /tmp/airis-desktop.log | tail -20`
4. For persistence changes: verify atomicity by killing the server
   mid-write (`pkill -9 -f "tsx watch"`) and confirming the on-disk file
   is either the old or new version — never a partial JSON.

## Things that have bitten us (server-side)

- A widget runner that called `createWidgetForSpace` directly without
  `nudgeLayoutBelowConflicts` caused every new lead-finder widget to
  stack at (0,0). The dispatcher's `widget.create` path does this
  correctly; runners must mirror it.
- Adding a dispatcher case without a corresponding prompt fragment means
  the LLM never emits the new execution type. Silent failure.
- `safeParse` on widget reads is non-negotiable. We've shipped corrupt
  widget files before and a `throw` here takes down the whole space load.
- Logs may interleave from concurrent processes. When grepping
  `/tmp/airis-desktop.log`, always use `grep -a` (binary-safe) and filter
  by `reqId` when available.

## Out of scope here

- Auth / multi-user (single user, default ID in `dispatcher.ts`).
- The SKILL.md loader (planned — `src/skills/` is reserved but empty).
- Per-space prompt overrides.

Do not scaffold these speculatively.
