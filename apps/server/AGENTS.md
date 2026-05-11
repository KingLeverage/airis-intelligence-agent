# apps/server — AGENTS.md

## Purpose

Thin **Fastify** API: filesystem persistence, LLM proxy, execution pipeline (parse → validate → dispatch), snapshots, browser transcribe.

## Key files

- `src/server.ts` — bootstrap, CORS, route registration
- `src/services/*` — **facades** re-exporting persistence, execution, LLM, browser, snapshots (Operator Space–style paths)
- `src/persistence/*` — paths, atomic IO, space/widget/chat loaders; **layout** is derived from each widget’s embedded `layout` (legacy `layout.json` merged when a widget file omits layout)
- `src/services/widgets/widget-mutations.ts` — validated widget create/update/delete (used by routes + snapshots)
- `src/utils/api-response.ts` — `{ ok, data }` / `{ ok, error }` helpers for spaces/widgets/layout routes
- `src/execution/*` — parser, validator, dispatcher, mutation logger
- `src/snapshots/service.ts` — full-space snapshot files + `index.json`; disk scan skips corrupt `*.json`; restore validates bundle before write, pre-restore backup required to succeed
- `src/snapshots/hooks.ts` — `snapshotAfterMutation` (respects `AUTO_SNAPSHOT`, `force: true`)
- `src/recovery/service.ts` — `inspectSpace` / `inspectAllSpaces`, repair basics, disable widget, invalid snapshot counts
- `src/snapshots/throttle.ts` — coalesces rapid **mutation** snapshots (`SNAPSHOT_MUTATION_MIN_INTERVAL_MS`)
- `src/llm/*` — adapters + `prompt-builder.ts` + `resolve-llm-runtime.ts` + `openai-compatible-chat.ts`
- `src/persistence/profile-llm-store.ts` — Zod-validated `profiles/{userId}/llm.json` (OpenRouter key + optional metadata; masked over HTTP)
- `src/routes/profile-llm.ts` — `GET/PUT /api/profile/llm`, `POST /api/profile/llm/openrouter/validate` (models list probe, no chat spend)
- `src/browser/transcribe.ts` — mock + cheerio fetch
- `src/browser/preview-html.ts` — same-origin iframe HTML preview; search-host mirrors for readable static results
- `src/browser/playwright-runtime.ts` — optional real Chromium when `AIRIS_PLAYWRIGHT=1`

## Workspace browser (iframe vs server fetch vs Playwright)

- **Operator web UI (`BrowserPanel`):** the iframe **`src` is the real `https://` URL**. The page executes in the **user’s desktop browser**; **remote JavaScript runs** in the iframe when the site allows framing (some return captchas or refuse embeds). This is **not** the same as server-side fetch.
- **Server-side transcription (what most agent context uses on `fetch`):** `POST …/browser/navigate` with **`mode: fetch`** (and related transcribe paths) **fetches HTML on the server**, then **`transcribe.ts` / Cheerio** produce **static text** (scripts stripped, no execution of remote JS on Fastify). **`GET /api/spaces/:spaceId/browser/preview?url=…`** is the same class: **sanitized static HTML** for optional same-origin preview tooling. Heavy SPAs look thin unless `preview-html.ts` substitutes a mirror (Google/Bing/Yelp-style search → readable HTML, etc.).
- **`mode: visual` on navigate:** updates session URL and a **minimal** transcription so the UI iframe tracks a URL **without** always re-fetching HTML on the server (reduces 403 noise on strict sites).
- **True headless “Chrome on the server” (optional):** **`AIRIS_PLAYWRIGHT=1`** and **`npx playwright install chromium`** so `browser.navigate` / click / type / scroll drive **Chromium** in `playwright-runtime.ts` and snapshots can reflect a **live-rendered** DOM.
- **Correct agent pattern for web search:** emit `browser.navigate` to a **full search-results URL** (`…/search?q=…`, encoded query). Do not narrate fake keystrokes into a search box unless Playwright is enabled and you are driving a real DOM.
- **Personal page script (`browser.evaluate`):** optional **`AIRIS_PERSONAL_BROWSER_EVAL=1`** (with Playwright) runs model-supplied async **function body** inside the **headless** page — **not** in the React workspace. **Do not** turn on for multi-tenant or internet-exposed servers without a security review.
- **Normal browser tab:** users use **↗** in the web UI when the iframe is blocked or they want a full tab. Execution stays **allowlisted `<<<EXECUTION`**.

## Invariants

- Validate all writes with `@airis/shared` Zod schemas.
- \`html-card\`: \`payload.html\` must not contain known placeholder YouTube video ids (e.g. canonical Rick-roll id); agents must embed **real** \`watch?v=\` / \`embed/\` ids from Browser context, user URLs, or citations.
- Use atomic write (temp file + rename) for JSON files.
- `chat.jsonl` append one JSON line per message.

## REST contract

See root README; paths under `/api`. Do not rename without updating `apps/web/src/lib/api.ts`.

- `GET /api/spaces/:spaceId/widgets/:widgetId/live-data` — allowlisted `dataSource.key` → `{ dataPatch, asOf, sourceKey?, warning? }` for client merge (no secrets in widget files).
- **CLI catalog (Printing Press):** `GET /api/spaces/:spaceId/cli-tools/catalog` — `{ tools, runsEnabled, customPrograms }`. Each catalog tool includes **`program`**, **`familyId`**, and **`familyLabel`** for UI grouping. `POST …/cli-tools/run` accepts **either** `{ toolKey }` (catalog preset) **or** `{ program, argsText }` where `program` is allowlisted (`coingecko-pp-cli`, `docker-hub-pp-cli`, `pypi-pp-cli`, `recipe-goat-pp-cli`, … — see **`CUSTOM_CLI_PROGRAMS`**) and `argsText` is quote-aware argv text (no shell, restricted charset, max args). Response includes `commandLine`, `stdout`, `stderr`, and **`readableSummary`**: heuristic JSON-to-text first, then (unless **`AIRIS_CLI_SUMMARY_LLM=0`**) a short LLM pass using **`resolveLlmRuntime`** (same keys as chat—no separate billing product). Override model with **`AIRIS_CLI_SUMMARY_MODEL_ID`**; Anthropic path uses **`AIRIS_CLI_SUMMARY_ANTHROPIC_MODEL`** (default Haiku). **Disabled by default**; set **`AIRIS_CLI_TOOLS=1`**. Presets include CoinGecko ping/doctor/coins list/markets/trending/global/search, Docker Hub doctor/search, PyPI doctor / RSS newest / RSS recent, and Recipe Goat doctor / **goat** cross-site rank (example chocolate-cake query with `--limit` + `--agent`). Chat may emit **`cli.tool.run`** execution blocks (same allowlist). If the server is started from a GUI and misses shell `PATH`, set **`AIRIS_CLI_EXTRA_PATH`** (OS path separator) to directories containing `*-pp-cli` binaries (in addition to auto-prepended `$(go env GOPATH)/bin` and `~/go/bin`). The upstream `npx @mvanhorn/printing-press install …` flow uses **`go install`** — **Go must be installed** (e.g. `brew install go`) unless you use a pre-built `*-pp-cli` from [printing-press-library releases](https://github.com/mvanhorn/printing-press-library/releases).
- `GET /api/spaces/:spaceId/exports` — list PDF exports for the space (`exportId`, optional `filename` from execution logs, `bytes`, `updatedAt`); scans `spaces/<spaceId>/exports/*.pdf`.
- `GET /api/spaces/:spaceId/exports/pdf/:exportId?filename=…` — binary PDF from `spaces/<spaceId>/exports/<exportId>.pdf` (written by `export.pdf` execution). Query `filename` is sanitized for `Content-Disposition` (optional; defaults to `export.pdf`).
- `GET /api/profile/llm` — masked LLM profile (never returns raw API keys).
- `PUT /api/profile/llm` — merge-update profile secrets/metadata (`clearOpenrouter`, `openrouter.apiKey`, etc.).
- `POST /api/profile/llm/openrouter/validate` — optional body `{ apiKey? }`; uses saved key when omitted; OpenRouter `GET /v1/models` only.
- **Reference library (multimodal corpus):** files + `index.json` under `users/{userId}/reference-library/` (initialized from `initGlobalFiles`).
  - `GET /api/reference-library` — list ingested assets (metadata only).
  - `GET /api/reference-library/search?q=…` — token match over title, tags, caption, filename, and extracted text for `.txt`/`.md`.
  - `POST /api/reference-library/ingest` — multipart: field `file` (required), optional `title`, `tags` (comma/semicolon/newline separated), `caption` (recommended for PDFs/images).
  - `GET /api/reference-library/:id/file` — inline download of the stored blob (size-capped).
  - `POST /api/reference-library/reindex-embeddings` — rebuild `files/*/embedding.json` for all entries (requires `AIRIS_EMBEDDING_MODEL` + API keys).
  - **Ingest:** PDFs run through `pdf-parse` into `textExtract`. Images may use vision caption when multipart `autoCaption=1` and `AIRIS_VISION_CAPTION_MODEL` is set.
  - **Search:** default blends keyword hits with cosine similarity when embeddings exist; `?mode=keyword` for text token match only.
  - **Chat RAG:** unless `AIRIS_REFERENCE_RAG_PROMPT=0`, top hybrid hits are injected into the system prompt (see `reference-library-rag.ts`).

## Synthetic fine-tuning (Path A)

- **Spec (shared):** [`packages/shared/src/sft/synthetic-training-spec.ts`](../../packages/shared/src/sft/synthetic-training-spec.ts) — chat-phase `type:` list, teacher appendix, widget payload hints. **`stripExecutionFences`** lives in [`packages/shared/src/protocol/execution.ts`](../../packages/shared/src/protocol/execution.ts) (same semantics as persisted assistant chat).
- **Validate JSONL:** `npm run sft:validate-path-a -w @airis/server -- <file.jsonl>` (see [`examples/sft/path-a.example.jsonl`](../../examples/sft/path-a.example.jsonl)).
- **Export single `text` column (e.g. Unsloth):** `npm run sft:export-unsloth -w @airis/server -- <in.jsonl> <out.jsonl>` — delimiter format v1 is documented in `scripts/export-path-a-unsloth.ts`.
- **Teacher → Path A rows:** set **`AIRIS_TEACHER_API_KEY`** (never commit keys); optional `AIRIS_TEACHER_BASE_URL`, `AIRIS_TEACHER_MODEL`, `AIRIS_TEACHER_OUT`. Run `npm run sft:teacher-path-a -w @airis/server -- --count 3`. Generated files under `examples/sft/generated/` are gitignored.
- **Colab / Unsloth:** open [`examples/sft/airis_patha_unsloth_colab.ipynb`](../../examples/sft/airis_patha_unsloth_colab.ipynb) in Google Colab (File → Upload notebook, or open from GitHub). It loads Path A JSONL, applies the Llama 3.1 chat template, runs QLoRA, and can push to the Hub.

## Extension points

- New route module in `src/routes/`, register in `server.ts`.
- New execution type: shared schema + validator + dispatcher + prompt docs.
- \`export.pdf\`: optional per-section \`chartWidgetId\` (same-space widget) — raster embeds for \`chart-panel\` (Chart.js + \`chartjs-node-canvas\`), \`metric-grid\`, and \`comparison-panel\` (both via native \`canvas\`). Requires a successful \`npm install\` (native \`canvas\` build) in this workspace.
