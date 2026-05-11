# Recommended folder tree (Operator Space–style)

This layout keeps **execution**, **persistence**, **widget registry**, and **browser** concerns separated—useful for AI-assisted development and for matching the public “browser-first workspace + disk-backed widgets” story.

> **AIRIS repo today:** root is `airis-intelligence-agent` with **npm** workspaces (`apps/web`, `apps/server`, `packages/shared`). The tree below is the **target shape** for deeper refactors; paths map 1:1 except workspace tool (`npm` vs `pnpm`).

```
operator-space/                    # or: airis-intelligence-agent/
├── AGENTS.md
├── README.md
├── architecture.md
├── package.json
├── pnpm-workspace.yaml            # optional; AIRIS uses npm "workspaces"
├── .gitignore
├── data/
│   └── users/
│       └── default/
│           ├── global/
│           │   └── settings.json
│           └── spaces/
├── apps/
│   ├── web/
│   │   ├── AGENTS.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── app/
│   │       │   ├── providers/
│   │       │   ├── router/
│   │       │   └── layout/
│   │       ├── components/
│   │       │   ├── shell/
│   │       │   ├── ui/
│   │       │   └── feedback/
│   │       ├── features/
│   │       │   ├── spaces/
│   │       │   ├── chat/
│   │       │   ├── widgets/
│   │       │   ├── executions/
│   │       │   ├── browser/
│   │       │   ├── snapshots/
│   │       │   └── recovery/
│   │       ├── stores/
│   │       ├── lib/
│   │       └── styles/
│   └── server/
│       ├── AGENTS.md
│       └── src/
│           ├── server.ts
│           ├── routes/
│           ├── services/          # SpaceService, WidgetService, Execution*, LLM, Snapshots
│           ├── persistence/
│           ├── validators/
│           └── config/
└── packages/
    └── shared/
        └── src/
            ├── constants/
            ├── schemas/
            ├── types/
            └── utils/
```

## AIRIS mapping (current)

| Recommended | AIRIS today |
|-------------|-------------|
| `apps/server/src/services/*` | **Stub facades** re-export `persistence`, `execution`, `llm`, `snapshots`, `browser`; implementations stay in place until migrated |
| `apps/web/src/app/*` | **Added** — `providers/`, `router/`, `layout/` compose `App` + `main` |
| `apps/web/src/components/*` | **Added** — `shell/` re-exports `features/shell`; `ui/`, `feedback/` placeholders |
| `apps/web/src/features/widgets/registry/*` | `apps/web/src/features/widgets/registry.tsx` + `WidgetViews.tsx` |
| `packages/shared/constants` | **Added** — derives from Zod enums |
| `packages/shared/schemas/common.ts` | **Added** — `EntityMeta`, ISO date, version |

## Schema note (do not blindly merge)

Starter packs often inline **layout + payload** on a single `Widget` document. **AIRIS** keeps **`layout.json`** separate from **`widgets/{id}.json`** to avoid coordinate drift. Greenfield `WidgetSchema` examples in blog posts should be adapted, not copied verbatim, if you keep this invariant.
