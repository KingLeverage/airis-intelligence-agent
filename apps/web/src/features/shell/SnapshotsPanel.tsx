import { useCallback, useEffect, useState } from "react";
import type { SnapshotMeta } from "@airis/shared";
import { api } from "../../lib/api";

type Props = {
  spaceId: string | null;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
};

export function SnapshotsPanel({ spaceId, open, onClose, onRestored }: Props) {
  const [list, setList] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setErr(null);
    try {
      const { snapshots } = await api.listSnapshots(spaceId);
      setList(snapshots);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (open && spaceId) void load();
  }, [open, spaceId, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-12 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Snapshots"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Snapshots</h2>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="border-b border-slate-800 px-4 py-2">
          <button
            type="button"
            disabled={!spaceId || busyId != null}
            className="rounded-md border border-cyan-800/50 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-40"
            onClick={() => {
              if (!spaceId) return;
              setBusyId("create");
              setSuccess(null);
              void api
                .createSnapshot(spaceId, "Manual snapshot", "manual")
                .then(() => load())
                .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusyId(null));
            }}
          >
            {busyId === "create" ? "Creating…" : "Create snapshot"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {err && (
            <div className="mb-3 rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-200">
              {err}
            </div>
          )}
          {success && (
            <div className="mb-3 rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-2 text-xs text-emerald-200">
              {success}
            </div>
          )}
          {loading && <p className="text-xs text-slate-500">Loading…</p>}
          {!loading && list.length === 0 && (
            <p className="text-xs text-slate-500">No snapshots yet.</p>
          )}
          <ul className="space-y-2">
            {list.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-500">{s.id.slice(0, 8)}…</span>
                  <span className="text-slate-500">{s.createdAt.slice(0, 19).replace("T", " ")}</span>
                </div>
                <div className="mt-1 text-slate-300">
                  {s.label ?? s.reason}
                  {s.metadata ? (
                    <span className="ml-2 text-slate-600">
                      · {s.metadata.widgetCount} widgets
                      {s.metadata.chatMessageCount != null
                        ? ` · ${s.metadata.chatMessageCount} msgs`
                        : ""}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={!spaceId || busyId != null}
                  className="mt-2 rounded border border-amber-900/40 px-2 py-1 text-[11px] text-amber-200/90 hover:bg-amber-950/30 disabled:opacity-40"
                  onClick={() => {
                    if (!spaceId) return;
                    if (
                      !confirm(
                        `Restore snapshot ${s.id.slice(0, 8)}? Current state will be backed up first.`,
                      )
                    ) {
                      return;
                    }
                    setBusyId(s.id);
                    setSuccess(null);
                    void api
                      .restoreSnapshot(spaceId, s.id)
                      .then((r) => {
                        setSuccess(
                          `Restored (${r.widgetCount} widgets). Backup: ${r.preRestoreSnapshotId?.slice(0, 8) ?? "—"}…`,
                        );
                        onRestored();
                        void load();
                      })
                      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                      .finally(() => setBusyId(null));
                  }}
                >
                  {busyId === s.id ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
