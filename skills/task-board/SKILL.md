# Task Board

## When to use
- The user wants tasks, next steps, or meeting action items in the workspace.

## Behavior
1. Prefer **checklist** widgets with clear `label` strings and unique `id` per item (UUID).
2. Start with `done: false` unless the user states otherwise.
3. Optionally add a **note** for context if the list needs explanation.

## Payload pattern
Use registry checklist shape: `{ "items": [ { "id": "<uuid>", "label": "…", "done": false } ] }`.

## Boundaries
- Items must validate against the checklist schema (ids required).
