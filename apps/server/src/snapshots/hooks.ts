import { createSnapshot } from "./service.js";
import { isAutoSnapshotEnabled } from "../config.js";

/**
 * Auto-snapshot after workspace mutations. Uses `force: true` so each mutation
 * is captured even when mutation throttling would coalesce bursts.
 */
export async function snapshotAfterMutation(
  spaceId: string,
  userId: string,
  label: string,
  affectedEntityIds: string[],
): Promise<void> {
  if (!isAutoSnapshotEnabled()) return;
  await createSnapshot(spaceId, "mutation", {
    label,
    affectedEntityIds,
    userId,
    force: true,
  });
}
