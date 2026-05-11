import fs from "node:fs/promises";
import path from "node:path";
import { coerceExecutionRecord } from "../../execution/coerce-record.js";
import { executionsDir, spaceExportsDir } from "../../persistence/paths.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SpaceExportListItem = {
  exportId: string;
  /** From the execution log when available; otherwise null. */
  filename: string | null;
  bytes: number;
  updatedAt: string;
  kind: "pdf" | "image";
};

async function exportFilenameMapFromExecutions(spaceId: string, userId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const dir = executionsDir(spaceId, userId);
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return map;
  }
  files.sort().reverse();
  for (const f of files.slice(0, 160)) {
    const text = await fs.readFile(path.join(dir, f), "utf8");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      continue;
    }
    const rec = coerceExecutionRecord(raw);
    if (!rec) continue;
    if (rec.pdfExports?.length) {
      for (const pe of rec.pdfExports) {
        if (!map.has(pe.exportId)) map.set(pe.exportId, pe.filename);
      }
    }
    if (rec.imageExports?.length) {
      for (const ie of rec.imageExports) {
        if (!map.has(ie.exportId)) map.set(ie.exportId, ie.filename);
      }
    }
  }
  return map;
}

/** PDFs and saved image exports on disk under `spaces/<id>/exports/`, enriched from execution logs. */
export async function listSpacePdfExports(
  spaceId: string,
  userId: string,
): Promise<SpaceExportListItem[]> {
  const namesById = await exportFilenameMapFromExecutions(spaceId, userId);
  const dir = spaceExportsDir(spaceId, userId);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }

  const items: SpaceExportListItem[] = [];
  for (const name of names) {
    let kind: SpaceExportListItem["kind"] | null = null;
    let exportId: string | null = null;
    if (name.endsWith(".pdf")) {
      kind = "pdf";
      exportId = name.slice(0, -".pdf".length);
    } else if (name.endsWith(".png")) {
      kind = "image";
      exportId = name.slice(0, -".png".length);
    } else if (name.endsWith(".jpeg")) {
      kind = "image";
      exportId = name.slice(0, -".jpeg".length);
    } else if (name.endsWith(".jpg")) {
      kind = "image";
      exportId = name.slice(0, -".jpg".length);
    } else if (name.endsWith(".webp")) {
      kind = "image";
      exportId = name.slice(0, -".webp".length);
    }
    if (!kind || !exportId || !UUID_RE.test(exportId)) continue;
    const full = path.join(dir, name);
    const st = await fs.stat(full).catch(() => null);
    if (!st?.isFile()) continue;
    items.push({
      exportId,
      filename: namesById.get(exportId) ?? null,
      bytes: st.size,
      updatedAt: st.mtime.toISOString(),
      kind,
    });
  }
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}
