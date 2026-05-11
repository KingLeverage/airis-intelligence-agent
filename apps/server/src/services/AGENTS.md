# apps/server/src/services — AGENTS.md

## Purpose

**Facade** modules that re-export today’s implementations from `persistence/`, `execution/`, `llm/`, `browser/`, and `snapshots/`. Lets new code follow a stable import path without a big-bang file move.

## Layout

| Path | Role |
|------|------|
| `spaces/` | Space CRUD, layout, settings, bundle load |
| `widgets/` | Widget file CRUD |
| `chat/` | Chat persistence + LLM + finalize |
| `executions/` | Parser, dispatcher, logger, finalize |
| `browser/` | Transcribe + session store |
| `llm/` | `respond`, `streamLlmResponse`, prompt builder |
| `snapshots/` | Snapshot CRUD + throttle helpers |
| `recovery/` | Placeholder for future recovery summaries |

## Invariants

- Facades **must not** add business logic until implementations are moved here intentionally.
- `routes/*` can be migrated incrementally to `import * as spaces from "../services/spaces/index.js"` etc.
