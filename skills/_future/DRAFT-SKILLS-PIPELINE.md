# Draft skills pipeline (implemented)

Staged skills live under **`skills/drafts/{draftId}/`** with the same layout as production (`skill.json`, `SKILL.md`, optional `templates/`).

## Flow

1. **Propose** — Create a folder under `drafts/` (via API `POST /api/skills/drafts` or manually on disk). **`draftId` must equal `manifest.id`** (kebab-case slug).
2. **Validate** — `GET /api/skills/drafts` / `POST /api/skills/drafts/:draftId/validate` run the same **strict** Zod checks as production (`allowedExecutionTypes` ⊆ protocol, `recommendedWidgets` ⊆ registry).
3. **Promote** — `POST /api/skills/drafts/:draftId/promote` copies to `skills/{id}/`, sets **`enabledByDefault: false`**, and removes the draft folder.
4. **Enable** — Operator enables the new skill per space in the UI (or edits `skills.json`).

## API (summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/skills/drafts` | List drafts + validation state |
| POST | `/api/skills/drafts` | Create draft from JSON body |
| GET | `/api/skills/drafts/:draftId` | Inspect one draft |
| POST | `/api/skills/drafts/:draftId/validate` | Re-run validation |
| POST | `/api/skills/drafts/:draftId/promote` | Promote to production |
| DELETE | `/api/skills/drafts/:draftId` | Delete draft |

There is **no** arbitrary code execution, npm installs, or remote URL loading.

## Future

- Optional **review queue** / approval roles  
- **Import bundle** (zip) with checksum  
- **Conflict resolution** when promoting over an existing skill (currently blocked)

See also: `DRAFT-SKILLS-PIPELINE.md` history in git for the original “planned” note.
