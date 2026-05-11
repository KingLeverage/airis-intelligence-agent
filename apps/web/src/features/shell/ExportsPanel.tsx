import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

type SpaceExportRow = {
  exportId: string;
  filename: string | null;
  bytes: number;
  updatedAt: string;
  kind: "pdf" | "image";
};

type Props = {
  spaceId: string | null;
  open: boolean;
  onClose: () => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ExportsPanel({ spaceId, open, onClose }: Props) {
  const [rows, setRows] = useState<SpaceExportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setErr(null);
    try {
      const { exports: list } = await api.listSpaceExports(spaceId);
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (open && spaceId) void load();
  }, [open, spaceId, load]);

  useEffect(() => {
    if (!spaceId) return;
    const onExportsChanged = (ev: Event) => {
      const d = (ev as CustomEvent<{ spaceId?: string }>).detail;
      if (open && d?.spaceId === spaceId) void load();
    };
    window.addEventListener("airis-space-exports-changed", onExportsChanged);
    return () => window.removeEventListener("airis-space-exports-changed", onExportsChanged);
  }, [open, spaceId, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-12 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace exports"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Exports</h2>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="border-b border-slate-800 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
          PDFs and generated images live under <span className="font-mono text-slate-400">exports/</span>. PDFs
          come from <span className="font-mono text-slate-400">export.pdf</span>; images are saved when you use an
          OpenRouter image model (e.g. <span className="font-mono text-slate-400">openrouter:openai/gpt-5.4-image-2</span>
          ). Use <strong className="text-slate-400">Download</strong> or <strong className="text-slate-400">Refresh</strong>
          ; if this panel is open when a turn finishes, the list can refresh automatically.
        </p>
        <div className="border-b border-slate-800 px-4 py-2">
          <button
            type="button"
            disabled={!spaceId || loading}
            className="rounded-md border border-cyan-800/50 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-40"
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {err && (
            <div className="mb-3 rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-200">
              {err}
            </div>
          )}
          {loading && <p className="text-xs text-slate-500">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-xs text-slate-500">
              No exports yet. Use <span className="font-mono text-slate-400">export.pdf</span> for PDFs, or generate an
              image with an OpenRouter image model — files appear here when the turn completes.
            </p>
          )}
          <ul className="space-y-2">
            {rows.map((r) => {
              const fallbackName = r.kind === "pdf" ? "export.pdf" : "image.png";
              const label = r.filename?.trim() || `export-${r.exportId.slice(0, 8)}-${fallbackName}`;
              const href =
                r.kind === "pdf"
                  ? api.spaceExportPdfUrl(spaceId!, r.exportId, r.filename ?? undefined)
                  : api.spaceExportImageUrl(spaceId!, r.exportId, r.filename ?? undefined);
              return (
                <li
                  key={`${r.kind}-${r.exportId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-200" title={label}>
                      <span className="mr-1.5 rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] uppercase text-slate-400">
                        {r.kind}
                      </span>
                      {label}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {formatBytes(r.bytes)} · {formatWhen(r.updatedAt)} · {r.exportId.slice(0, 8)}…
                    </div>
                  </div>
                  <a
                    href={href}
                    className="shrink-0 rounded-md border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-950/70"
                    download
                  >
                    Download
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
