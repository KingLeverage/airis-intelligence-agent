import fs from "node:fs/promises";
import { v4 as uuid } from "uuid";
import { ensureDir } from "../../persistence/fs-utils.js";
import { spaceExportRasterPath, spaceExportsDir } from "../../persistence/paths.js";

const DATA_URL_IMG = /data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/gi;

const MAX_IMAGES_PER_TURN = 8;
const MIN_BYTES = 256;
const MAX_BYTES = 15 * 1024 * 1024;

function fileExtForMime(m: string): "png" | "jpeg" | "webp" {
  const x = m.toLowerCase();
  if (x === "png") return "png";
  if (x === "webp") return "webp";
  return "jpeg";
}

/**
 * Persist inline `data:image/...;base64,...` payloads from assistant text under `spaces/<id>/exports/`.
 * Deduplicates identical data URLs. Intended for OpenRouter image models only (caller gates `modelId`).
 */
export async function saveDataUrlImagesToSpaceExports(opts: {
  spaceId: string;
  userId: string;
  text: string;
}): Promise<{ exportId: string; filename: string }[]> {
  const { spaceId, userId, text } = opts;
  if (!text.includes("data:image/")) return [];

  const seen = new Set<string>();
  const out: { exportId: string; filename: string }[] = [];
  let imgIdx = 0;
  for (const m of text.matchAll(DATA_URL_IMG)) {
    if (out.length >= MAX_IMAGES_PER_TURN) break;
    const full = m[0];
    if (seen.has(full)) continue;
    seen.add(full);
    const mimePart = m[1].toLowerCase();
    const b64 = m[2].replace(/\s/g, "");
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      continue;
    }
    if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) continue;

    const ext = fileExtForMime(mimePart === "jpg" ? "jpeg" : mimePart);
    const exportId = uuid();
    const filename = `generated-${++imgIdx}.${ext}`;
    await ensureDir(spaceExportsDir(spaceId, userId));
    const filePath = spaceExportRasterPath(spaceId, exportId, ext, userId);
    await fs.writeFile(filePath, buf);
    out.push({ exportId, filename });
  }
  return out;
}
