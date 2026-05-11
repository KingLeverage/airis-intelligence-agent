import { useEffect, useState } from "react";
import type { SpaceMeta } from "@airis/shared";

type Props = {
  space: SpaceMeta;
  onOpen: () => void;
  onDelete?: () => void;
};

function formatUpdatedShort(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SpaceCard({ space, onOpen, onDelete }: Props) {
  const slug = space.slug ?? space.id.slice(0, 8);
  const updated = formatUpdatedShort(space.updatedAt);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [space.id, space.previewUpdatedAt]);

  const showPreview = Boolean(space.previewUpdatedAt) && !imgFailed;
  const previewSrc = space.previewUpdatedAt
    ? `/api/spaces/${space.id}/preview?v=${encodeURIComponent(space.previewUpdatedAt)}`
    : null;

  return (
    <div className="group relative aspect-square max-h-44">
      <button
        type="button"
        onClick={onOpen}
        className="airis-transition-surface relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--airis-border-glass)] text-left shadow-[var(--airis-shadow-soft)] transition hover:border-[color:rgba(134,183,255,0.35)] hover:shadow-[0_0_24px_rgba(134,183,255,0.08)]"
      >
        {showPreview && previewSrc ? (
          <>
            <img
              src={previewSrc}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover opacity-95 blur-[12px]"
              onError={() => setImgFailed(true)}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/58 via-black/48 to-black/70" />
            <div className="pointer-events-none absolute inset-0 backdrop-blur-[3px] bg-[color:rgba(10,12,20,0.42)]" />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[color:rgba(255,255,255,0.08)] to-[color:rgba(255,255,255,0.03)] backdrop-blur-md" />
        )}

        <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col p-3.5">
          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[color:var(--airis-text-tertiary)]">
            Workspace
          </p>
          <h3 className="mt-1 line-clamp-2 pr-7 text-[0.95rem] font-semibold leading-snug tracking-tight text-[color:var(--airis-text-primary)] [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
            {space.name}
          </h3>
          <p className="mt-1.5 truncate font-mono text-[9px] text-[color:var(--airis-text-tertiary)] [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
            {slug}
          </p>
          <p className="mt-2 text-[10px] text-[color:var(--airis-text-tertiary)] [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
            Updated <span className="text-[color:var(--airis-text-secondary)]">{updated}</span>
          </p>
          <div className="mt-auto pt-2 text-[10px] font-medium text-[color:var(--airis-accent-iris)] opacity-0 transition group-hover:opacity-100 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
            Open workspace →
          </div>
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Delete workspace ${space.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 z-20 rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(12,14,22,0.85)] px-2 py-1 text-[10px] font-medium text-[color:var(--airis-text-secondary)] backdrop-blur-sm transition hover:border-red-500/40 hover:text-red-300"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
