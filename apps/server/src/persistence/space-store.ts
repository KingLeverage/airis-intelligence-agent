import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  ChatMessageSchema,
  LayoutStateSchema,
  type ChatMessage,
  type LayoutState,
  type SpaceMeta,
  type SpaceSettings,
  type WidgetLoadWarning,
  type WidgetRecord,
  SpaceMetaSchema,
  SpaceSettingsSchema,
  WidgetRecordSchema,
} from "@airis/shared";
import { DEFAULT_USER_ID } from "../config.js";
import { slugFromName } from "../utils/slug.js";
import {
  appendJsonl,
  atomicWriteBuffer,
  atomicWriteJson,
  atomicWriteText,
  ensureDir,
  listJsonFiles,
  parseJsonl,
  readJsonWithSchema,
  readTextIfExists,
} from "./fs-utils.js";
import { spaceExportsDir } from "./paths.js";
import { initReferenceLibrary } from "./reference-library-store.js";
import {
  executionsDir,
  globalDir,
  snapshotsDir,
  spaceDir,
  spaceFile,
  spacesRoot,
  widgetsDir,
} from "./paths.js";

const DEFAULT_INSTRUCTIONS = `# Space instructions\n\nDescribe how the agent should behave in this space.\n`;

export const SPACE_PREVIEW_JPEG = "space-preview.jpg";

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

function isJpegBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export async function saveSpacePreviewJpeg(
  spaceId: string,
  jpeg: Buffer,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceMeta | null> {
  if (jpeg.length === 0 || jpeg.length > MAX_PREVIEW_BYTES) return null;
  if (!isJpegBuffer(jpeg)) return null;
  const meta = await getSpaceMeta(spaceId, userId);
  if (!meta) return null;
  await ensureSpaceFiles(spaceId, userId);
  const path = spaceFile(spaceId, SPACE_PREVIEW_JPEG, userId);
  await atomicWriteBuffer(path, jpeg);
  const now = new Date().toISOString();
  const next: SpaceMeta = { ...meta, previewUpdatedAt: now };
  await writeSpaceMeta(next, userId);
  return next;
}

export async function readSpacePreviewJpeg(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<Buffer | null> {
  const p = spaceFile(spaceId, SPACE_PREVIEW_JPEG, userId);
  try {
    return await fs.readFile(p);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw e;
  }
}

export async function initGlobalFiles(userId: string = DEFAULT_USER_ID): Promise<void> {
  await ensureDir(globalDir(userId));
  await initReferenceLibrary(userId);
  const settingsPath = path.join(globalDir(userId), "settings.json");
  if ((await readTextIfExists(settingsPath)) == null) {
    await atomicWriteJson(settingsPath, { theme: "iris-deepfield", defaultModelId: "mock" });
  }
  const modelsPath = path.join(globalDir(userId), "models.json");
  if ((await readTextIfExists(modelsPath)) == null) {
    await atomicWriteJson(modelsPath, {
      models: [
        { id: "mock", label: "Mock", provider: "mock", model: "mock-1" },
        { id: "anthropic", label: "Claude (env)", provider: "anthropic", model: "claude-sonnet-4-20250514" },
        { id: "openai", label: "OpenAI compatible", provider: "openai-compatible", model: "gpt-4o-mini" },
      ],
    });
  }
}

export async function listSpaceIds(userId: string = DEFAULT_USER_ID): Promise<string[]> {
  await ensureDir(spacesRoot(userId));
  const entries = await fs.readdir(spacesRoot(userId), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Ensures per-space files exist and repairs common gaps (missing settings / instructions).
 * TODO: attach full recovery / corrupt-file archival here.
 */
export async function ensureSpaceFiles(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<void> {
  const dir = spaceDir(spaceId, userId);
  await ensureDir(dir);
  await ensureDir(widgetsDir(spaceId, userId));
  await ensureDir(executionsDir(spaceId, userId));
  await ensureDir(snapshotsDir(spaceId, userId));
  await ensureDir(spaceExportsDir(spaceId, userId));

  const settingsPath = spaceFile(spaceId, "settings.json", userId);
  const settingsText = await readTextIfExists(settingsPath);
  if (settingsText == null) {
    await atomicWriteJson(settingsPath, { theme: "iris-deepfield" } satisfies SpaceSettings);
  } else {
    const r = await readJsonWithSchema(settingsPath, SpaceSettingsSchema);
    if (!r.ok) {
      console.warn(`[space-store] ${spaceId}: settings.json invalid (${r.error}), rewriting defaults`);
      await atomicWriteJson(settingsPath, { theme: "iris-deepfield" } satisfies SpaceSettings);
    }
  }

  const instrPath = spaceFile(spaceId, "instructions.md", userId);
  if ((await readTextIfExists(instrPath)) == null) {
    await atomicWriteText(instrPath, DEFAULT_INSTRUCTIONS);
  }
}

export async function createSpace(name: string, userId: string = DEFAULT_USER_ID): Promise<SpaceMeta> {
  await initGlobalFiles(userId);
  const id = uuid();
  const now = new Date().toISOString();
  const dir = spaceDir(id, userId);
  await ensureDir(dir);
  await ensureDir(widgetsDir(id, userId));
  await ensureDir(executionsDir(id, userId));
  await ensureDir(snapshotsDir(id, userId));

  const meta: SpaceMeta = {
    id,
    name,
    slug: slugFromName(name),
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
  await atomicWriteJson(spaceFile(id, "space.json", userId), meta);
  await atomicWriteJson(spaceFile(id, "settings.json", userId), { theme: "iris-deepfield" } satisfies SpaceSettings);
  await atomicWriteText(spaceFile(id, "instructions.md", userId), DEFAULT_INSTRUCTIONS);
  await atomicWriteText(spaceFile(id, "chat.jsonl", userId), "");

  return meta;
}

export async function getSpaceMeta(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceMeta | null> {
  const r = await readJsonWithSchema(spaceFile(spaceId, "space.json", userId), SpaceMetaSchema);
  return r.ok ? r.data : null;
}

export async function listSpacesMeta(userId: string = DEFAULT_USER_ID): Promise<SpaceMeta[]> {
  const ids = await listSpaceIds(userId);
  const out: SpaceMeta[] = [];
  for (const id of ids) {
    const m = await getSpaceMeta(id, userId);
    if (m) out.push(m);
    else console.warn(`[space-store] skipping space directory ${id}: invalid or missing space.json`);
  }
  out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return out;
}

export async function deleteSpace(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<boolean> {
  const dir = spaceDir(spaceId, userId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function writeSpaceMeta(meta: SpaceMeta, userId: string = DEFAULT_USER_ID): Promise<void> {
  const p = SpaceMetaSchema.safeParse(meta);
  if (!p.success) throw new Error(`invalid_space_meta: ${p.error.message}`);
  await atomicWriteJson(spaceFile(p.data.id, "space.json", userId), p.data);
}

/**
 * Deep-copies a space directory to a new id. Widget files are rewritten with the new `spaceId`.
 * Demo/template flags are cleared on the copy. Chat is cleared on the clone.
 */
export async function cloneSpace(sourceSpaceId: string, userId: string = DEFAULT_USER_ID): Promise<SpaceMeta | null> {
  const srcMeta = await getSpaceMeta(sourceSpaceId, userId);
  if (!srcMeta) return null;

  const newId = uuid();
  const srcDir = spaceDir(sourceSpaceId, userId);
  const dstDir = spaceDir(newId, userId);

  await fs.cp(srcDir, dstDir, { recursive: true });

  const now = new Date().toISOString();
  const baseName = srcMeta.name.replace(/\s*\(demo\)\s*$/i, "").trim() || srcMeta.name;
  const newName = `${baseName} (yours)`;

  const newMeta: SpaceMeta = {
    id: newId,
    name: newName,
    slug: slugFromName(newName),
    createdAt: now,
    updatedAt: now,
    version: 0,
  };

  await writeSpaceMeta(newMeta, userId);

  try {
    await fs.rm(spaceFile(newId, SPACE_PREVIEW_JPEG, userId), { force: true });
  } catch {
    /* ignore */
  }

  const wDir = widgetsDir(newId, userId);
  const files = await listJsonFiles(wDir);
  for (const f of files) {
    const fullPath = path.join(wDir, f);
    const r = await readJsonWithSchema(fullPath, WidgetRecordSchema);
    if (!r.ok) continue;
    const w = r.data;
    const next: WidgetRecord = {
      ...w,
      spaceId: newId,
      updatedAt: now,
      version: w.version + 1,
    };
    await saveWidget(next, userId);
  }

  await atomicWriteText(spaceFile(newId, "chat.jsonl", userId), "");
  return getSpaceMeta(newId, userId);
}

export async function touchSpace(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<void> {
  const meta = await getSpaceMeta(spaceId, userId);
  if (!meta) return;
  const next: SpaceMeta = {
    ...meta,
    updatedAt: new Date().toISOString(),
    version: meta.version + 1,
  };
  await atomicWriteJson(spaceFile(spaceId, "space.json", userId), next);
}

export async function readSettings(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceSettings> {
  await ensureSpaceFiles(spaceId, userId);
  const r = await readJsonWithSchema(spaceFile(spaceId, "settings.json", userId), SpaceSettingsSchema);
  if (r.ok) return r.data;
  return { theme: "iris-deepfield" };
}

export async function readInstructions(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<string> {
  await ensureSpaceFiles(spaceId, userId);
  const t = await readTextIfExists(spaceFile(spaceId, "instructions.md", userId));
  return t ?? "";
}

async function loadLegacyLayoutMap(
  spaceId: string,
  userId: string,
): Promise<Map<string, { x: number; y: number; w: number; h: number }>> {
  const m = new Map<string, { x: number; y: number; w: number; h: number }>();
  const r = await readJsonWithSchema(spaceFile(spaceId, "layout.json", userId), LayoutStateSchema);
  if (!r.ok) return m;
  for (const e of r.data.widgets) {
    m.set(e.widgetId, { x: e.x, y: e.y, w: e.w, h: e.h });
  }
  return m;
}

function deriveLayoutFromWidgets(widgets: WidgetRecord[]): LayoutState {
  const sorted = [...widgets].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x || a.id.localeCompare(b.id),
  );
  return {
    widgets: sorted.map((w) => ({
      widgetId: w.id,
      x: w.layout.x,
      y: w.layout.y,
      w: w.layout.w,
      h: w.layout.h,
    })),
  };
}

export async function listWidgetRecordsDetailed(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<{ valid: WidgetRecord[]; warnings: WidgetLoadWarning[] }> {
  await ensureSpaceFiles(spaceId, userId);
  const legacyMap = await loadLegacyLayoutMap(spaceId, userId);
  const dir = widgetsDir(spaceId, userId);
  const files = await listJsonFiles(dir);
  const warnings: WidgetLoadWarning[] = [];
  const valid: WidgetRecord[] = [];

  for (const base of files) {
    const fullPath = path.join(dir, base);
    const text = await readTextIfExists(fullPath);
    if (text == null) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      warnings.push({ file: base, code: "invalid_json", message: "JSON parse failed" });
      console.warn(`[widgets] ${spaceId}/${base}: invalid_json`);
      continue;
    }
    if (typeof raw !== "object" || raw === null || !("id" in raw)) {
      warnings.push({ file: base, code: "invalid_shape", message: "missing widget id" });
      continue;
    }
    const o = raw as Record<string, unknown>;
    const wid = typeof o.id === "string" ? o.id : undefined;
    if (!o.layout && wid && legacyMap.has(wid)) {
      o.layout = legacyMap.get(wid);
    }
    const p = WidgetRecordSchema.safeParse(o);
    if (!p.success) {
      warnings.push({
        file: base,
        widgetId: wid,
        code: "validation_failed",
        message: p.error.message,
      });
      console.warn(`[widgets] ${spaceId}/${base}: validation_failed`);
      continue;
    }
    valid.push(p.data);
  }

  return { valid, warnings };
}

export async function listWidgetRecords(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<WidgetRecord[]> {
  const { valid } = await listWidgetRecordsDetailed(spaceId, userId);
  return valid;
}

export async function readLayout(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<LayoutState> {
  const { valid } = await listWidgetRecordsDetailed(spaceId, userId);
  return deriveLayoutFromWidgets(valid);
}

/** Persists layout by updating each widget’s embedded `layout` field (no separate layout engine). */
export async function writeLayout(
  spaceId: string,
  layout: LayoutState,
  userId: string = DEFAULT_USER_ID,
): Promise<void> {
  for (const e of layout.widgets) {
    const w = await getWidget(spaceId, e.widgetId, userId);
    if (!w) continue;
    if (w.layout.x === e.x && w.layout.y === e.y && w.layout.w === e.w && w.layout.h === e.h) continue;
    const next: WidgetRecord = {
      ...w,
      layout: { x: e.x, y: e.y, w: e.w, h: e.h },
      updatedAt: new Date().toISOString(),
      version: w.version + 1,
    };
    await saveWidget(next, userId);
  }
  await touchSpace(spaceId, userId);
}

export async function getWidget(
  spaceId: string,
  widgetId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<WidgetRecord | null> {
  await ensureSpaceFiles(spaceId, userId);
  const fullPath = path.join(widgetsDir(spaceId, userId), `${widgetId}.json`);
  const text = await readTextIfExists(fullPath);
  if (text == null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const legacyMap = await loadLegacyLayoutMap(spaceId, userId);
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : widgetId;
    if (!o.layout && legacyMap.has(id)) {
      o.layout = legacyMap.get(id);
    }
  }
  const p = WidgetRecordSchema.safeParse(raw);
  return p.success ? p.data : null;
}

export async function saveWidget(record: WidgetRecord, userId: string = DEFAULT_USER_ID): Promise<void> {
  await atomicWriteJson(path.join(widgetsDir(record.spaceId, userId), `${record.id}.json`), record);
  await touchSpace(record.spaceId, userId);
}

export async function deleteWidgetFile(
  spaceId: string,
  widgetId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<void> {
  try {
    await fs.unlink(path.join(widgetsDir(spaceId, userId), `${widgetId}.json`));
  } catch {
    /* ignore */
  }
  await touchSpace(spaceId, userId);
}

/** Removes all widget JSON files for a space (e.g. before re-applying a dashboard recipe). */
export async function deleteAllWidgetsInSpace(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<number> {
  await ensureSpaceFiles(spaceId, userId);
  const dir = widgetsDir(spaceId, userId);
  const files = await listJsonFiles(dir);
  let n = 0;
  for (const f of files) {
    try {
      await fs.unlink(path.join(dir, f));
      n += 1;
    } catch {
      /* ignore */
    }
  }
  await touchSpace(spaceId, userId);
  return n;
}

export async function readChat(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<ChatMessage[]> {
  const text = await readTextIfExists(spaceFile(spaceId, "chat.jsonl", userId));
  if (!text?.trim()) return [];
  const lines = parseJsonl(text);
  const out: ChatMessage[] = [];
  for (const line of lines) {
    const p = ChatMessageSchema.safeParse(line);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function appendChatMessage(
  msg: ChatMessage,
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<void> {
  await appendJsonl(spaceFile(spaceId, "chat.jsonl", userId), msg);
  await touchSpace(spaceId, userId);
}

/** Replace persisted chat with an empty file (clears history for the space). */
export async function clearChat(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<void> {
  await atomicWriteText(spaceFile(spaceId, "chat.jsonl", userId), "");
  await touchSpace(spaceId, userId);
}

export async function loadSpaceBundle(spaceId: string, userId: string = DEFAULT_USER_ID) {
  await ensureSpaceFiles(spaceId, userId);
  const space = await getSpaceMeta(spaceId, userId);
  if (!space) return null;
  const settings = await readSettings(spaceId, userId);
  const { valid: widgets, warnings: widgetLoadWarnings } = await listWidgetRecordsDetailed(spaceId, userId);
  const layout = deriveLayoutFromWidgets(widgets);
  const chat = await readChat(spaceId, userId);
  const instructions = await readInstructions(spaceId, userId);
  return { space, settings, layout, widgets, chat, instructions, widgetLoadWarnings };
}
