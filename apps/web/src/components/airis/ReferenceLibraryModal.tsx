import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

type Entry = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  ingestedAt: string;
  title?: string;
  tags: string[];
  caption?: string;
};

export function ReferenceLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [caption, setCaption] = useState("");
  const [autoCaption, setAutoCaption] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listReferenceLibrary();
      setEntries(r.entries);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      if (tags.trim()) fd.append("tags", tags.trim());
      if (caption.trim()) fd.append("caption", caption.trim());
      if (autoCaption) fd.append("autoCaption", "1");
      await api.ingestReferenceLibrary(fd);
      setTitle("");
      setTags("");
      setCaption("");
      setAutoCaption(false);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onReindex() {
    setReindexBusy(true);
    setError(null);
    try {
      await api.reindexReferenceLibraryEmbeddings();
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReindexBusy(false);
    }
  }

  const filtered =
    searchQ.trim().length < 2
      ? entries
      : entries.filter((e) => {
          const q = searchQ.toLowerCase();
          return (
            e.originalName.toLowerCase().includes(q) ||
            (e.title ?? "").toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q)) ||
            (e.caption ?? "").toLowerCase().includes(q)
          );
        });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-lib-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.96)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--airis-border-glass)] px-4 py-3">
          <h2 id="ref-lib-title" className="text-sm font-semibold text-[color:var(--airis-text-primary)]">
            Reference library
          </h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[11px] text-[color:var(--airis-text-secondary)] hover:bg-[color:rgba(255,255,255,0.06)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[12px] text-[color:var(--airis-text-secondary)]">
          <p className="leading-relaxed">
            Uploads are indexed for search. Set <span className="font-mono text-[10px]">AIRIS_EMBEDDING_MODEL</span> on
            the server for vectors + hybrid search and chat RAG. Set{" "}
            <span className="font-mono text-[10px]">AIRIS_VISION_CAPTION_MODEL</span> for optional image auto-caption.
          </p>
          <div className="space-y-2 rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(255,255,255,0.02)] p-3">
            <label className="block text-[10px] font-medium uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
              File
              <input
                type="file"
                className="mt-1 block w-full text-[11px] file:mr-2 file:rounded file:border-0 file:bg-[color:var(--airis-accent-iris)] file:px-2 file:py-1 file:text-[10px] file:text-slate-950"
                disabled={loading}
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  ev.target.value = "";
                  void onUpload(f);
                }}
              />
            </label>
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.8)] px-2 py-1.5 text-[11px] text-[color:var(--airis-text-primary)]"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.8)] px-2 py-1.5 text-[11px] text-[color:var(--airis-text-primary)]"
            />
            <textarea
              placeholder="Caption (optional; helps PDFs / images without extractable text)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="w-full resize-none rounded border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.8)] px-2 py-1.5 text-[11px] text-[color:var(--airis-text-primary)]"
            />
            <label className="flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={autoCaption} onChange={(e) => setAutoCaption(e.target.checked)} />
              Auto-caption images (vision model)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reindexBusy || loading}
              onClick={() => void onReindex()}
              className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--airis-accent-iris)] hover:bg-[color:rgba(134,183,255,0.08)] disabled:opacity-40"
            >
              {reindexBusy ? "Reindexing…" : "Reindex embeddings"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-1.5 text-[11px] text-[color:var(--airis-text-secondary)] hover:bg-[color:rgba(255,255,255,0.04)] disabled:opacity-40"
            >
              Refresh list
            </button>
          </div>
          <input
            type="search"
            placeholder="Filter list…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full rounded border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.8)] px-2 py-1.5 text-[11px] text-[color:var(--airis-text-primary)]"
          />
          {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
          {loading && entries.length === 0 ? <p className="text-[11px]">Loading…</p> : null}
          <ul className="space-y-2">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(255,255,255,0.02)] px-2 py-2"
              >
                <div className="font-medium text-[color:var(--airis-text-primary)]">{e.title || e.originalName}</div>
                <div className="mt-0.5 font-mono text-[10px] text-[color:var(--airis-text-tertiary)]">{e.id}</div>
                <div className="mt-1 text-[10px] text-[color:var(--airis-text-tertiary)]">
                  {e.mime} · {(e.size / 1024).toFixed(1)} KB
                </div>
                {e.caption ? <p className="mt-1 text-[10px] leading-snug text-[color:var(--airis-text-secondary)]">{e.caption}</p> : null}
                {e.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded bg-[color:rgba(56,189,248,0.12)] px-1.5 py-0.5 text-[9px]">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <a
                  href={api.referenceLibraryFileUrl(e.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[10px] text-[color:var(--airis-accent-iris)] hover:underline"
                >
                  Open file
                </a>
              </li>
            ))}
          </ul>
          {!loading && filtered.length === 0 ? <p className="text-[11px] text-[color:var(--airis-text-tertiary)]">No entries yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
