import path from "node:path";
import { fileURLToPath } from "node:url";

export function getDataDir(): string {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
}

/** Repo `skills/` tree (declarative manifests). Override with SKILLS_DIR. */
export function getSkillsDir(): string {
  if (process.env.SKILLS_DIR) return process.env.SKILLS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", "skills");
}

export function getPort(): number {
  return Number(process.env.PORT ?? 8787);
}

export function getHost(): string {
  return process.env.HOST ?? "0.0.0.0";
}

export const DEFAULT_USER_ID = "default";

export function getDefaultModelId(): string {
  return process.env.DEFAULT_MODEL_ID ?? "mock";
}

/** When false, widget/layout/dispatcher hooks skip automatic mutation snapshots. */
export function isAutoSnapshotEnabled(): boolean {
  const v = process.env.AUTO_SNAPSHOT;
  if (v === "0" || v === "false") return false;
  return true;
}

/**
 * When `AIRIS_ALLOW_FLAGSHIP_DEMO_RECIPE_REFRESH=1`, `POST /api/dev/reapply-flagship-demo-recipes` is registered.
 * **Off by default** — never set in production unless you accept destructive widget rewrites on seeded demos.
 */
export function isFlagshipDemoRecipeRefreshEnabled(): boolean {
  return process.env.AIRIS_ALLOW_FLAGSHIP_DEMO_RECIPE_REFRESH === "1";
}

/**
 * When `AIRIS_PREVIEW_UNSAFE_FULL_PAGE=1`, `GET …/browser/preview` keeps scripts, iframes, and inline handlers
 * in fetched HTML. The document is served **same-origin** as the AIRIS web app, so remote JS runs with access
 * to that origin — **solo / trusted dev machines only**; never on shared or production hosts.
 */
export function isPreviewUnsafeFullPageEnabled(): boolean {
  return process.env.AIRIS_PREVIEW_UNSAFE_FULL_PAGE === "1";
}

/** When false, skip injecting reference-library RAG into chat system prompts. */
export function isReferenceRagPromptEnabled(): boolean {
  const v = process.env.AIRIS_REFERENCE_RAG_PROMPT;
  if (v === "0" || v === "false") return false;
  return true;
}

/** OpenAI-compatible embedding model slug (e.g. `openai/text-embedding-3-small` on OpenRouter). */
export function getEmbeddingModel(): string | undefined {
  const m = process.env.AIRIS_EMBEDDING_MODEL?.trim();
  return m && m !== "0" && m !== "off" ? m : undefined;
}

/** Optional override for `/v1/embeddings`; defaults to the resolved chat API base. */
export function getEmbeddingBaseUrlOverride(): string | undefined {
  const u = process.env.AIRIS_EMBEDDING_BASE_URL?.trim();
  return u && u !== "0" ? u : undefined;
}

/** Vision model for ingest auto-caption; unset disables auto-caption API calls. */
export function getVisionCaptionModel(): string | undefined {
  const m = process.env.AIRIS_VISION_CAPTION_MODEL?.trim();
  return m && m !== "0" && m !== "off" ? m : undefined;
}

/**
 * When false, `POST …/cli-tools/run` is rejected (catalog GET still works).
 * Default **off** so internet-exposed servers do not spawn subprocesses unless opted in.
 */
export function isCliToolsRunEnabled(): boolean {
  return process.env.AIRIS_CLI_TOOLS === "1";
}

/**
 * Extra directories prepended to `PATH` when spawning allowlisted CLIs (in addition to
 * `~/go/bin` and `$(go env GOPATH)/bin`). Use when the server is started from a GUI and
 * misses your shell `PATH` — e.g. `AIRIS_CLI_EXTRA_PATH=/Users/you/go/bin`
 * (multiple entries: use the OS path separator).
 */
export function getCliToolsExtraPathSegments(): string[] {
  const raw = process.env.AIRIS_CLI_EXTRA_PATH?.trim();
  if (!raw) return [];
  const sep = path.delimiter;
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}
