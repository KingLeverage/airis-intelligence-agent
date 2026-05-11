import path from "node:path";
import { DEFAULT_USER_ID, getDataDir } from "../config.js";

export function usersRoot(): string {
  return path.join(getDataDir(), "users");
}

export function userRoot(userId: string = DEFAULT_USER_ID): string {
  return path.join(usersRoot(), userId);
}

export function globalDir(userId: string = DEFAULT_USER_ID): string {
  return path.join(userRoot(userId), "global");
}

export function spacesRoot(userId: string = DEFAULT_USER_ID): string {
  return path.join(userRoot(userId), "spaces");
}

export function spaceDir(spaceId: string, userId: string = DEFAULT_USER_ID): string {
  return path.join(spacesRoot(userId), spaceId);
}

export function spaceFile(spaceId: string, name: string, userId?: string): string {
  return path.join(spaceDir(spaceId, userId), name);
}

export function widgetsDir(spaceId: string, userId?: string): string {
  return path.join(spaceDir(spaceId, userId), "widgets");
}

export function executionsDir(spaceId: string, userId?: string): string {
  return path.join(spaceDir(spaceId, userId), "executions");
}

export function snapshotsDir(spaceId: string, userId?: string): string {
  return path.join(spaceDir(spaceId, userId), "snapshots");
}

export function spaceExportsDir(spaceId: string, userId: string = DEFAULT_USER_ID): string {
  return path.join(spaceDir(spaceId, userId), "exports");
}

export function spaceExportPdfPath(spaceId: string, exportId: string, userId?: string): string {
  return path.join(spaceExportsDir(spaceId, userId), `${exportId}.pdf`);
}

export function spaceExportRasterPath(
  spaceId: string,
  exportId: string,
  ext: "png" | "jpeg" | "webp",
  userId?: string,
): string {
  return path.join(spaceExportsDir(spaceId, userId), `${exportId}.${ext}`);
}

/** Per-space browser workspace session (transcription + action log). */
export function browserSessionFile(spaceId: string, userId?: string): string {
  return spaceFile(spaceId, "browser-session.json", userId);
}

/** User-scoped multimodal corpus (PDFs, images, notes) + `index.json` manifest. */
export function referenceLibraryRoot(userId: string = DEFAULT_USER_ID): string {
  return path.join(userRoot(userId), "reference-library");
}

export function referenceLibraryIndexFile(userId: string = DEFAULT_USER_ID): string {
  return path.join(referenceLibraryRoot(userId), "index.json");
}

export function referenceLibraryBlobDir(entryId: string, userId: string = DEFAULT_USER_ID): string {
  return path.join(referenceLibraryRoot(userId), "files", entryId);
}
