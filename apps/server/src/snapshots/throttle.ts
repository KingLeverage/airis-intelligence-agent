/**
 * Coalesces high-frequency mutation snapshots (disk + index churn).
 * Manual / pre-restore snapshots bypass via createSnapshot({ force: true }).
 */

const lastMutationSnapshotMs = new Map<string, number>();

export function getMutationSnapshotMinIntervalMs(): number {
  const raw = process.env.SNAPSHOT_MUTATION_MIN_INTERVAL_MS;
  const n = raw ? Number(raw) : 4000;
  return Number.isFinite(n) && n >= 0 ? n : 4000;
}

export function shouldSkipMutationSnapshot(spaceId: string): boolean {
  const minMs = getMutationSnapshotMinIntervalMs();
  if (minMs === 0) return false;
  const now = Date.now();
  const prev = lastMutationSnapshotMs.get(spaceId) ?? 0;
  return now - prev < minMs;
}

export function markMutationSnapshot(spaceId: string): void {
  lastMutationSnapshotMs.set(spaceId, Date.now());
}
