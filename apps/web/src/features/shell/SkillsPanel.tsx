import { useCallback, useEffect, useState } from "react";
import type { SpaceSkillAnalytics } from "@airis/shared";
import { useSkillsStore } from "../../stores/skills-store";
import { useSessionStore } from "../../stores/session-store";
import { api } from "../../lib/api";

type Props = {
  spaceId: string | null;
  open: boolean;
  onClose: () => void;
};

type Tab = "space" | "drafts" | "usage";

export function SkillsPanel({ spaceId, open, onClose }: Props) {
  const { skills, loading, error, loadForSpace, enable, disable, setPinned } = useSkillsStore();
  const lastMetrics = useSessionStore((s) => s.lastSkillPromptMetrics);
  const [tab, setTab] = useState<Tab>("space");
  const [busy, setBusy] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof api.listSkillDrafts>>["drafts"]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsErr, setDraftsErr] = useState<string | null>(null);
  const [newDraftId, setNewDraftId] = useState("");
  const [newManifestJson, setNewManifestJson] = useState(
    '{\n  "id": "my-skill",\n  "name": "My skill",\n  "description": "…",\n  "version": "0.1.0",\n  "category": "general",\n  "tags": [],\n  "triggers": [],\n  "allowedExecutionTypes": ["widget.create"],\n  "recommendedWidgets": ["note"],\n  "entryInstructionFile": "SKILL.md",\n  "enabledByDefault": false\n}',
  );
  const [newSkillMd, setNewSkillMd] = useState("# My skill\n\n…");

  const [analytics, setAnalytics] = useState<SpaceSkillAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState<string | null>(null);

  const loadSpace = useCallback(() => {
    void loadForSpace(spaceId);
  }, [spaceId, loadForSpace]);

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    setDraftsErr(null);
    try {
      const { drafts: d } = await api.listSkillDrafts();
      setDrafts(d);
    } catch (e) {
      setDraftsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!spaceId) return;
    setAnalyticsLoading(true);
    setAnalyticsErr(null);
    try {
      const { analytics: a } = await api.getSpaceSkillAnalytics(spaceId);
      setAnalytics(a);
    } catch (e) {
      setAnalyticsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (!open) return;
    if (tab === "space" && spaceId) loadSpace();
    if (tab === "drafts") void loadDrafts();
    if (tab === "usage" && spaceId) void loadAnalytics();
  }, [open, tab, spaceId, loadSpace, loadDrafts, loadAnalytics]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-12 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Skills"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Skills</h2>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="flex gap-1 border-b border-slate-800 px-2 py-2">
          {(
            [
              ["space", "This space"],
              ["drafts", "Drafts"],
              ["usage", "Usage"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded px-2 py-1 text-xs ${
                tab === id
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "space" && (
            <>
              {error && (
                <div className="mb-3 rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}
              {loading && <p className="text-xs text-slate-500">Loading…</p>}
              {!loading && skills.length === 0 && (
                <p className="text-xs text-slate-500">No production skills discovered.</p>
              )}
              <ul className="space-y-2">
                {skills.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200">{s.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{s.id}</div>
                        <div className="mt-1 text-slate-400">{s.description}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                          {s.category}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled={!spaceId || busy != null}
                          className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-cyan-600/50 disabled:opacity-40"
                          onClick={() => {
                            if (!spaceId) return;
                            setBusy(s.id);
                            const p = s.enabled ? disable(spaceId, s.id) : enable(spaceId, s.id);
                            void p.finally(() => setBusy(null));
                          }}
                        >
                          {busy === s.id ? "…" : s.enabled ? "Disable" : "Enable"}
                        </button>
                        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            disabled={!spaceId || !s.enabled || busy != null}
                            checked={Boolean(s.pinned)}
                            onChange={(e) => {
                              if (!spaceId) return;
                              setBusy(`pin-${s.id}`);
                              void setPinned(spaceId, s.id, e.target.checked).finally(() =>
                                setBusy(null),
                              );
                            }}
                          />
                          Pin
                        </label>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "drafts" && (
            <>
              <p className="mb-2 text-[10px] text-slate-500">
                Drafts live in <code className="text-slate-400">skills/drafts/{"{id}"}</code>.
                Manifest <code className="text-slate-400">id</code> must match the folder name.
                Promoting copies to <code className="text-slate-400">skills/</code> with{" "}
                <code className="text-slate-400">enabledByDefault: false</code>.
              </p>
              {draftsErr && (
                <div className="mb-2 rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-200">
                  {draftsErr}
                </div>
              )}
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300"
                  onClick={() => void loadDrafts()}
                  disabled={draftsLoading}
                >
                  {draftsLoading ? "Refreshing…" : "Refresh list"}
                </button>
              </div>
              <ul className="mb-4 space-y-2">
                {drafts.map((d) => (
                  <li
                    key={d.draftId}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                  >
                    <div className="font-mono text-[10px] text-slate-400">{d.draftId}</div>
                    <div className="text-[10px] text-slate-500">
                      {d.valid ? (
                        <span className="text-emerald-400">Valid</span>
                      ) : (
                        <span className="text-red-300">Invalid</span>
                      )}
                      {d.warnings.length > 0 ? ` · ${d.warnings.join("; ")}` : ""}
                    </div>
                    {!d.valid && d.errors.length > 0 && (
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-red-200/90">
                        {d.errors.join("\n")}
                      </pre>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={!d.valid || busy != null}
                        className="rounded border border-emerald-800/60 px-2 py-0.5 text-[10px] text-emerald-200 disabled:opacity-40"
                        onClick={() => {
                          setBusy(`promote-${d.draftId}`);
                          void api
                            .promoteSkillDraft(d.draftId)
                            .then(() => loadDrafts())
                            .then(() => {
                              if (spaceId) return loadForSpace(spaceId);
                            })
                            .catch((e) => setDraftsErr(e instanceof Error ? e.message : String(e)))
                            .finally(() => setBusy(null));
                        }}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        disabled={busy != null}
                        className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400"
                        onClick={() => {
                          setBusy(`del-${d.draftId}`);
                          void api
                            .deleteSkillDraft(d.draftId)
                            .then(() => loadDrafts())
                            .catch((e) => setDraftsErr(e instanceof Error ? e.message : String(e)))
                            .finally(() => setBusy(null));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="rounded border border-slate-800 bg-slate-900/30 p-2">
                <div className="text-[10px] font-medium text-slate-400">Create draft (API)</div>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200"
                  placeholder="draft id (e.g. my-skill)"
                  value={newDraftId}
                  onChange={(e) => setNewDraftId(e.target.value)}
                />
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200"
                  rows={8}
                  value={newManifestJson}
                  onChange={(e) => setNewManifestJson(e.target.value)}
                />
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"
                  rows={3}
                  placeholder="SKILL.md body (optional)"
                  value={newSkillMd}
                  onChange={(e) => setNewSkillMd(e.target.value)}
                />
                <button
                  type="button"
                  className="mt-1 rounded border border-cyan-800/50 px-2 py-1 text-[10px] text-cyan-200"
                  disabled={busy != null}
                  onClick={() => {
                    let manifest: unknown;
                    try {
                      manifest = JSON.parse(newManifestJson) as unknown;
                    } catch {
                      setDraftsErr("Invalid manifest JSON");
                      return;
                    }
                    setBusy("create-draft");
                    void api
                      .createSkillDraft({
                        draftId: newDraftId.trim(),
                        manifest,
                        skillMd: newSkillMd.trim() || undefined,
                      })
                      .then(() => loadDrafts())
                      .catch((e) => setDraftsErr(e instanceof Error ? e.message : String(e)))
                      .finally(() => setBusy(null));
                  }}
                >
                  Create draft
                </button>
              </div>
            </>
          )}

          {tab === "usage" && (
            <>
              {!spaceId && (
                <p className="text-xs text-slate-500">Select a space to view usage.</p>
              )}
              {spaceId && analyticsErr && (
                <div className="mb-2 rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-200">
                  {analyticsErr}
                </div>
              )}
              {spaceId && analyticsLoading && (
                <p className="text-xs text-slate-500">Loading analytics…</p>
              )}
              {spaceId && analytics && (
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="rounded border border-slate-800 bg-slate-900/40 px-2 py-2">
                    <div className="text-[10px] text-slate-500">Aggregated (this space)</div>
                    <div>Turns recorded: {analytics.turnsRecorded}</div>
                    <div>
                      Σ skill-section chars (estimate): {analytics.totalEstimatedSkillPromptChars}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Not tokenizer-accurate; discovery + activation + template hints only.
                    </div>
                  </div>
                  {lastMetrics && (
                    <div className="rounded border border-amber-900/30 bg-amber-950/20 px-2 py-2">
                      <div className="text-[10px] text-amber-200/80">Last chat turn</div>
                      <div>Skills section total: {lastMetrics.skillsSectionTotalChars} chars</div>
                      <div>
                        Breakdown: discovery {lastMetrics.discoveryChars}, activation{" "}
                        {lastMetrics.activationChars}, templates {lastMetrics.templateHintsChars}
                      </div>
                      <div>Routed: {(lastMetrics.activeSkillIds ?? []).join(", ") || "—"}</div>
                    </div>
                  )}
                  <div className="text-[10px] font-medium text-slate-400">By skill</div>
                  <ul className="space-y-1">
                    {Object.entries(analytics.bySkillId)
                      .sort((a, b) => b[1].routedCount - a[1].routedCount)
                      .map(([id, row]) => (
                        <li
                          key={id}
                          className="rounded border border-slate-800/80 px-2 py-1 font-mono text-[10px] text-slate-400"
                        >
                          {id}: routed {row.routedCount}×, instruction chars Σ{" "}
                          {row.instructionCharsInjected}
                          {row.lastRoutedAt ? ` · last ${row.lastRoutedAt.slice(0, 19)}` : ""}
                        </li>
                      ))}
                  </ul>
                  {Object.keys(analytics.bySkillId).length === 0 && (
                    <p className="text-[10px] text-slate-600">No routed skills recorded yet.</p>
                  )}
                  <button
                    type="button"
                    className="text-[10px] text-cyan-500 hover:text-cyan-400"
                    onClick={() => void loadAnalytics()}
                  >
                    Refresh
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
          Production manifests are validated against execution types and widget kinds. Drafts use the same
          rules before promote.
        </div>
      </div>
    </div>
  );
}
