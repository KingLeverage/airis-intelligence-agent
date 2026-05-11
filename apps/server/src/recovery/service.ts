import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { RecoveryIssue, RecoverySummary, SnapshotMeta, SpaceRecoveryDetail } from "@airis/shared";
import { SnapshotBundleSchema } from "@airis/shared";
import * as store from "../persistence/space-store.js";
import { getSnapshot, listSnapshots } from "../snapshots/service.js";
import { snapshotsDir, spaceFile } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";
import { readTextIfExists } from "../persistence/fs-utils.js";

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

function iss(
  spaceId: string,
  severity: RecoveryIssue["severity"],
  entityType: RecoveryIssue["entityType"],
  message: string,
  entityId?: string,
): RecoveryIssue {
  return {
    id: uuid(),
    spaceId,
    severity,
    entityType,
    entityId,
    message,
    detectedAt: new Date().toISOString(),
  };
}

export async function countInvalidSnapshotFiles(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<number> {
  const dir = snapshotsDir(spaceId, userId);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let n = 0;
  for (const f of files) {
    if (f === "index.json" || !UUID_FILE.test(f)) continue;
    const text = await readTextIfExists(path.join(dir, f));
    if (text == null) {
      n++;
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      n++;
      continue;
    }
    if (!SnapshotBundleSchema.safeParse(raw).success) n++;
  }
  return n;
}

export async function inspectSpace(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<SpaceRecoveryDetail> {
  const issues: RecoveryIssue[] = [];
  const meta = await store.getSpaceMeta(spaceId, userId);
  const name = meta?.name ?? "(unknown)";
  let loadError: string | undefined;

  if (!meta) {
    loadError = "missing_or_invalid_space_meta";
    issues.push(iss(spaceId, "error", "space", "space.json missing or invalid"));
    let snapshots: SnapshotMeta[] = [];
    try {
      snapshots = await listSnapshots(spaceId, userId);
    } catch {
      /* ignore */
    }
    return {
      spaceId,
      name,
      issues,
      snapshotCount: snapshots.length,
      widgetCount: 0,
      invalidWidgetCount: 0,
      invalidSnapshotCount: await countInvalidSnapshotFiles(spaceId, userId),
      loadError,
      snapshots,
      brokenWidgets: [],
    };
  }

  const { valid: widgets, warnings } = await store.listWidgetRecordsDetailed(spaceId, userId);
  for (const w of warnings) {
    issues.push(
      iss(
        spaceId,
        "error",
        "widget",
        `${w.file}: ${w.code} — ${w.message.slice(0, 200)}`,
        w.widgetId ?? w.file.replace(/\.json$/, ""),
      ),
    );
  }

  if (meta) {
    if ((await readTextIfExists(spaceFile(spaceId, "settings.json", userId))) == null) {
      issues.push(iss(spaceId, "warning", "settings", "settings.json missing"));
    }
    if ((await readTextIfExists(spaceFile(spaceId, "instructions.md", userId))) == null) {
      issues.push(iss(spaceId, "warning", "instructions", "instructions.md missing"));
    }
  }

  const invalidSnap = await countInvalidSnapshotFiles(spaceId, userId);
  if (invalidSnap > 0) {
    issues.push(
      iss(spaceId, "warning", "snapshot", `${invalidSnap} invalid snapshot file(s) on disk`),
    );
  }

  let snapshots: SnapshotMeta[] = [];
  try {
    snapshots = await listSnapshots(spaceId, userId);
  } catch {
    issues.push(iss(spaceId, "error", "snapshot", "failed to list snapshots"));
  }

  const brokenWidgets: SpaceRecoveryDetail["brokenWidgets"] = warnings.map((w) => ({
    id: w.widgetId ?? w.file,
    file: w.file,
    error: w.message,
  }));

  return {
    spaceId,
    name,
    issues,
    snapshotCount: snapshots.length,
    widgetCount: widgets.length,
    invalidWidgetCount: warnings.length,
    invalidSnapshotCount: invalidSnap,
    loadError,
    snapshots,
    brokenWidgets,
  };
}

export async function inspectAllSpaces(userId: string = DEFAULT_USER_ID): Promise<RecoverySummary[]> {
  let ids: string[] = [];
  try {
    ids = await store.listSpaceIds(userId);
  } catch {
    return [];
  }
  const out: RecoverySummary[] = [];
  for (const id of ids) {
    const d = await inspectSpace(id, userId);
    out.push({
      spaceId: d.spaceId,
      name: d.name,
      issues: d.issues,
      snapshotCount: d.snapshotCount,
      widgetCount: d.widgetCount,
      invalidWidgetCount: d.invalidWidgetCount,
      invalidSnapshotCount: d.invalidSnapshotCount,
      loadError: d.loadError,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function repairSpaceBasics(
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<{ repaired: string[] }> {
  const repaired: string[] = [];
  if (!(await store.getSpaceMeta(spaceId, userId))) {
    return { repaired };
  }
  await store.ensureSpaceFiles(spaceId, userId);
  repaired.push("ensureSpaceFiles");
  return { repaired };
}

export async function disableWidgetForRecovery(
  spaceId: string,
  widgetId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const w = await store.getWidget(spaceId, widgetId, userId);
  if (!w) return { ok: false, error: "widget_not_found_or_unreadable" };
  const next = {
    ...w,
    status: "disabled" as const,
    updatedAt: new Date().toISOString(),
    version: w.version + 1,
    lastError: "disabled_via_recovery",
  };
  await store.saveWidget(next, userId);
  return { ok: true };
}

export async function validateSnapshotForRestore(
  spaceId: string,
  snapshotId: string,
  userId: string = DEFAULT_USER_ID,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bundle = await getSnapshot(spaceId, snapshotId, userId);
  if (!bundle) return { ok: false, error: "snapshot_not_found_or_invalid" };
  return { ok: true };
}
