# AIRIS reference library (scaffold)

Multimodal design and research references live here **on disk** first; retrieval (embeddings, PDF chunks, image captions) plugs in later without moving files.

## Layout

| Path | Purpose |
|------|---------|
| `charts/` | Chart screenshots, exports, palette grabs |
| `dashboards/` | Full-board references |
| `research/` | Brief layouts, evidence tables, narrative cards |
| `colors/` | Swatches, token dumps, contrast notes |
| `pdfs/` | Source PDFs (ingestion never executes in the widget runtime) |
| `metadata/` | One JSON sidecar per asset (see `metadata/schema.example.json`) |

## Runtime ingest (API)

The **live** corpus is stored under the server data dir (`users/<id>/reference-library/`), not this repo folder. Use:

- `GET /api/reference-library` — manifest list
- `POST /api/reference-library/ingest` — multipart `file` + optional `title`, `tags`, `caption`
- `GET /api/reference-library/search?q=…` — keyword search (full text for `.txt`/`.md`; PDFs/images benefit from `caption`)
- `GET /api/reference-library/:id/file` — fetch bytes

The web client exposes these via `api` in `apps/web/src/lib/api.ts`.

## Next phase (optional)

1. **Richer extract:** PDF text pipelines, image captions, embeddings.
2. **Retrieve:** prepend top-k chunks into chat context or skill activation (no client `eval`).

AIRIS execution stays **recipe + trusted renderers**; references **bias** the model, they do not become executable code.
