import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { SnapshotBundle, SnapshotMeta } from "@airis/shared";
import { SnapshotBundleSchema } from "@airis/shared";
import { atomicWriteJson, readJsonWithSchema } from "../persistence/fs-utils.js";
import { browserSessionFile, snapshotsDir, spaceFile, widgetsDir } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";
import * as browserSessionStore from "../browser/session-store.js";
import * as store from "../persistence/space-store.js";
import { closePlaywrightForSpace } from "../browser/playwright-runtime.js";
import { markMutationSnapshot, shouldSkipMutationSnapshot } from "./throttle.js";
import { getSpaceSkillConfig } from "../skills/space-skill-service.js";

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

async function readBundleFile(
  file: string,
): Promise<{ ok: true; data: SnapshotBundle } | { ok: false; error: string }> {
  return readJsonWithSchema(file, SnapshotBundleSchema);
}

/** Sync index.json from validated snapshot files on disk (best-effort). */
export async function syncSnapshotIndex(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<void> {
  const metas = await listSnapshots(spaceId, userId);
  await atomicWriteJson(path.join(snapshotsDir(spaceId, userId), "index.json"), metas);
}

export async function listSnapshots(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SnapshotMeta[]> {
  const dir = snapshotsDir(spaceId, userId);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const metas: SnapshotMeta[] = [];
  for (const f of files) {
    if (f === "index.json" || !UUID_FILE.test(f)) continue;
    const full = path.join(dir, f);
    const r = await readBundleFile(full);
    if (r.ok) {
      metas.push(r.data.meta);
    } else {
      console.warn(`[snapshots] skipping corrupt snapshot file ${spaceId}/${f}: ${r.error}`);
    }
  }

  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return metas;
}

async function writeSnapshotIndex(
  spaceId: string,
  metas: SnapshotMeta[],
  userId: string,
): Promise<void> {
  await atomicWriteJson(path.join(snapshotsDir(spaceId, userId), "index.json"), metas);
}

export async function createSnapshot(
  spaceId: string,
  reason: SnapshotMeta["reason"],
  opts: {
    label?: string;
    affectedEntityIds?: string[];
    userId?: string;
    /** When false, mutation snapshots may be skipped if within throttle window */
    force?: boolean;
  } = {},
): Promise<SnapshotBundle | null> {
  const userId = opts.userId ?? DEFAULT_USER_ID;
  if (reason === "mutation" && opts.force !== true && shouldSkipMutationSnapshot(spaceId)) {
    return null;
  }
  const bundle = await store.loadSpaceBundle(spaceId, userId);
  if (!bundle) return null;

  const chat = await store.readChat(spaceId, userId);
  const instructions = await store.readInstructions(spaceId, userId);
  const browserSession = await browserSessionStore.getSession(spaceId, userId);
  const spaceSkills = await getSpaceSkillConfig(spaceId, userId);
  const id = uuid();
  const meta: SnapshotMeta = {
    id,
    spaceId,
    createdAt: new Date().toISOString(),
    reason,
    label: opts.label,
    affectedEntityIds: opts.affectedEntityIds ?? [],
    metadata: {
      widgetCount: bundle.widgets.length,
      chatMessageCount: chat.length,
    },
  };

  const full: SnapshotBundle = {
    meta,
    space: bundle.space,
    settings: bundle.settings,
    layout: bundle.layout,
    widgets: bundle.widgets,
    chatTail: chat.slice(-50),
    instructions,
    browserSession,
    spaceSkills,
  };

  await fs.mkdir(snapshotsDir(spaceId, userId), { recursive: true });
  const file = path.join(snapshotsDir(spaceId, userId), `${id}.json`);
  await atomicWriteJson(file, full);

  const existing = await listSnapshots(spaceId, userId);
  await writeSnapshotIndex(spaceId, existing, userId);
  if (reason === "mutation") markMutationSnapshot(spaceId);
  return full;
}

export async function getSnapshot(
  spaceId: string,
  snapshotId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SnapshotBundle | null> {
  const file = path.join(snapshotsDir(spaceId, userId), `${snapshotId}.json`);
  const r = await readBundleFile(file);
  return r.ok ? r.data : null;
}

export type RestoreResult =
  | { ok: true; widgetCount: number; preRestoreSnapshotId?: string }
  | { ok: false; error: string };

/**
 * Validates snapshot before any write. Pre-restore backup runs only after validation.
 * All-or-nothing widget directory replace.
 */
export async function restoreSnapshot(
  spaceId: string,
  snapshotId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<RestoreResult> {
  const snap = await getSnapshot(spaceId, snapshotId, userId);
  if (!snap) return { ok: false, error: "snapshot_not_found_or_invalid" };

  const pre = await createSnapshot(spaceId, "pre-restore", {
    label: `pre-restore backup before ${snapshotId}`,
    userId,
    force: true,
  });
  if (!pre) return { ok: false, error: "pre_restore_backup_failed" };
  const preRestoreSnapshotId = pre.meta.id;

  const DEFAULT_INSTRUCTIONS = `# Space instructions\n\nDescribe how the agent should behave in this space.\n`;

  await atomicWriteJson(spaceFile(spaceId, "space.json", userId), snap.space);
  await atomicWriteJson(spaceFile(spaceId, "settings.json", userId), snap.settings);
  await atomicWriteJson(spaceFile(spaceId, "layout.json", userId), snap.layout);

  const instrPath = spaceFile(spaceId, "instructions.md", userId);
  await fs.mkdir(path.dirname(instrPath), { recursive: true });
  await fs.writeFile(
    instrPath,
    snap.instructions ?? DEFAULT_INSTRUCTIONS,
    "utf8",
  );

  const wd = widgetsDir(spaceId, userId);
  await fs.mkdir(wd, { recursive: true });
  for (const f of await fs.readdir(wd)) {
    if (f.endsWith(".json")) await fs.unlink(path.join(wd, f));
  }
  for (const w of snap.widgets) {
    await atomicWriteJson(path.join(wd, `${w.id}.json`), w);
  }

  if (snap.browserSession) {
    await atomicWriteJson(browserSessionFile(spaceId, userId), snap.browserSession);
    browserSessionStore.invalidateBrowserSessionCache(spaceId, userId);
  }
  if (snap.spaceSkills) {
    await atomicWriteJson(spaceFile(spaceId, "skills.json", userId), snap.spaceSkills);
  }
  await closePlaywrightForSpace(spaceId);

  await store.touchSpace(spaceId, userId);
  await syncSnapshotIndex(spaceId, userId);
  return { ok: true, widgetCount: snap.widgets.length, preRestoreSnapshotId };
}
