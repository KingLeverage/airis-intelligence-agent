import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RecoverySummary, SpaceRecoveryDetail } from "@airis/shared";
import { api } from "../../lib/api";

export function RecoveryPage() {
  const [spaces, setSpaces] = useState<RecoverySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpaceRecoveryDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadSpaces = useCallback(async () => {
    setErr(null);
    const { spaces: s } = await api.recoverySpaces();
    setSpaces(s);
    setSelectedId((cur) => cur ?? (s[0]?.spaceId ?? null));
  }, []);

  const loadDetail = useCallback(async (spaceId: string) => {
    setErr(null);
    const d = await api.recoverySpaceDetail(spaceId);
    setDetail(d);
  }, []);

  useEffect(() => {
    void loadSpaces().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [loadSpaces]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [selectedId, loadDetail]);

  const issueCount = (s: RecoverySummary) => s.issues.filter((i) => i.severity === "error").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="flex h-12 items-center justify-between border-b border-slate-800 px-4">
        <div>
          <h1 className="text-sm font-semibold text-amber-100">Admin · Recovery</h1>
          <p className="text-[10px] text-slate-500">Inspection and repair — does not depend on workspace canvas.</p>
        </div>
        <Link to="/" className="text-xs text-cyan-400 hover:underline">
          ← Workspace
        </Link>
      </div>

      <div className="flex min-h-[calc(100vh-3rem)]">
        <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-950/90 p-3">
          <button
            type="button"
            className="mb-3 w-full rounded border border-slate-700 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
            onClick={() => void loadSpaces()}
          >
            Refresh spaces
          </button>
          {err && (
            <div className="mb-3 rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-200">{err}</div>
          )}
          {!spaces && <p className="text-xs text-slate-500">Loading…</p>}
          <ul className="space-y-1">
            {spaces?.map((s) => (
              <li key={s.spaceId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.spaceId)}
                  className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                    s.spaceId === selectedId ? "bg-slate-800 text-cyan-100" : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                    <span>{s.snapshotCount} snaps</span>
                    {s.invalidWidgetCount > 0 && (
                      <span className="text-amber-400">{s.invalidWidgetCount} bad widgets</span>
                    )}
                    {issueCount(s) > 0 && <span className="text-red-400">{issueCount(s)} errors</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {toast && (
            <div className="mb-4 rounded border border-emerald-900/40 bg-emerald-950/25 px-3 py-2 text-sm text-emerald-100">
              {toast}
            </div>
          )}
          {!selectedId && <p className="text-sm text-slate-500">Select a space.</p>}
          {detail && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-slate-100">{detail.name}</h2>
                <p className="font-mono text-xs text-slate-500">{detail.spaceId}</p>
                {detail.loadError && (
                  <p className="mt-2 text-sm text-amber-200">Load error: {detail.loadError}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy != null}
                  className="rounded-md border border-cyan-800/50 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
                  onClick={() => {
                    setBusy("repair");
                    setToast(null);
                    void api
                      .recoveryRepair(detail.spaceId)
                      .then((r) => {
                        setToast(`Repaired: ${r.repaired.join(", ") || "nothing"}`);
                        return loadDetail(detail.spaceId);
                      })
                      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === "repair" ? "Repairing…" : "Repair basics (settings / instructions)"}
                </button>
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Issues</h3>
                {detail.issues.length === 0 ? (
                  <p className="text-xs text-emerald-600/90">No issues detected.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.issues.map((i) => (
                      <li
                        key={i.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          i.severity === "error"
                            ? "border-red-900/50 bg-red-950/20"
                            : "border-amber-900/40 bg-amber-950/15"
                        }`}
                      >
                        <span className="font-semibold">{i.severity}</span> · {i.entityType}
                        {i.entityId ? ` · ${i.entityId}` : ""}
                        <div className="mt-1 text-slate-300">{i.message}</div>
                        {i.entityType === "widget" && i.entityId ? (
                          <button
                            type="button"
                            className="mt-2 rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-500"
                            onClick={() => {
                              if (!i.entityId) return;
                              setBusy(`dis-${i.entityId}`);
                              void api
                                .recoveryDisableWidget(detail.spaceId, i.entityId)
                                .then(() => {
                                  setToast(`Disabled widget ${i.entityId?.slice(0, 8)}…`);
                                  return loadDetail(detail.spaceId);
                                })
                                .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                                .finally(() => setBusy(null));
                            }}
                          >
                            Disable widget (if loadable)
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Snapshots ({detail.snapshots.length})
                </h3>
                <ul className="space-y-2">
                  {detail.snapshots.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono text-slate-500">{s.id.slice(0, 8)}…</span>
                        <span className="ml-2 text-slate-400">{s.createdAt.slice(0, 19)}</span>
                        <div className="text-slate-300">{s.label ?? s.reason}</div>
                      </div>
                      <button
                        type="button"
                        disabled={busy != null}
                        className="rounded border border-amber-900/40 px-2 py-1 text-[11px] text-amber-200/90 disabled:opacity-40"
                        onClick={() => {
                          if (!confirm(`Restore ${s.id.slice(0, 8)}?`)) return;
                          setBusy(`rs-${s.id}`);
                          void api
                            .restoreSnapshot(detail.spaceId, s.id)
                            .then((r) => {
                              setToast(
                                `Restored ${r.widgetCount} widgets. Pre-backup: ${r.preRestoreSnapshotId?.slice(0, 8) ?? "—"}`,
                              );
                              return loadDetail(detail.spaceId);
                            })
                            .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                            .finally(() => setBusy(null));
                        }}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {detail.brokenWidgets.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Broken widget files
                  </h3>
                  <ul className="space-y-1 text-xs text-red-300/90">
                    {detail.brokenWidgets.map((b) => (
                      <li key={b.file}>
                        {b.file}: {b.error.slice(0, 120)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
