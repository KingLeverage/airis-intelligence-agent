# AIRIS Intelligence Agent

Local-first **browser-first AI workspace**: conversational chat plus **EXECUTION** blocks that create and update widgets, file-backed spaces, snapshots, recovery tools, and a browser transcription subsystem (mock plus optional server-side fetch).

### Workspace browser (what runs where)

| Surface | What it is | JavaScript? |
|--------|------------|-------------|
| **Embedded panel (web UI)** | Iframe loads the real page URL in **your** desktop browser. | Remote site JS runs **in the iframe** if the site allows embedding (some block or show captchas). |
| **Agent `browser.navigate` + `fetch`** (and `/browser/preview` API) | Server downloads HTML and builds a **static** snapshot (scripts stripped). | **No** remote JS execution on the server—text-only transcription for the model. |
| **Playwright** | Set **`AIRIS_PLAYWRIGHT=1`** and run **`npx playwright install chromium`**. | **Headless Chromium on the server**—real DOM, automation, live-rendered snapshots. |

See [architecture.md](./architecture.md) and [apps/server/AGENTS.md](./apps/server/AGENTS.md) for detail.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env — set LLM keys or rely on mock mode
```

## Development

```bash
npm run dev
```

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8787](http://localhost:8787)

The web app uses the Vite dev proxy to `/api` (Fastify on port 8787). Chat uses **`POST /api/spaces/:id/chat/stream`** (NDJSON: `delta`, then `done`) for token-by-token UI updates; non-streaming `POST .../chat` remains available.

## Data directory

Persistence defaults to `../../data` from `apps/server` (i.e. a `data` folder at the repo root) when using the sample `.env`. Override with `DATA_DIR` when starting the server.

Backup `data/users/default/spaces/` for portability.

## Routes

- Main app: `/`
- Admin recovery: `/admin/recovery`

## Safety (MVP)

- Widgets are **registry React components** with Zod-validated payloads — no arbitrary `eval` in the shell.
- Execution blocks are parsed and validated server-side; unknown actions are rejected and logged.

## Documentation

See [AGENTS.md](./AGENTS.md) and nested `AGENTS.md` files per subsystem.
