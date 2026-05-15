import { useState } from "react";
import { useSpacesStore } from "../../stores/spaces-store";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { SpaceCard } from "./SpaceCard";

export function SpacesSection() {
  const spaces = useSpacesStore((s) => s.spaces);
  const selectSpace = useSpacesStore((s) => s.selectSpace);
  const deleteSpace = useSpacesStore((s) => s.deleteSpace);
  const loading = useSpacesStore((s) => s.loading);
  const [createOpen, setCreateOpen] = useState(false);

  const userSpaces = spaces.filter((s) => !s.demo);

  const onDeleteSpace = (id: string, name: string) => {
    const ok = window.confirm(`Delete workspace “${name}”? This cannot be undone.`);
    if (ok) void deleteSpace(id);
  };

  return (
    <section className="mt-10 sm:mt-12">
      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <h2 className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--airis-text-tertiary)]">
        Spaces
      </h2>
      {loading && (
        <p className="mt-4 text-center text-xs text-[color:var(--airis-text-tertiary)]">Loading…</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="airis-home-create-card group flex aspect-square max-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--airis-border-glass)] bg-[color:rgba(255,255,255,0.03)] text-[color:var(--airis-text-tertiary)] transition hover:border-[color:var(--airis-accent-iris)]/50 hover:text-[color:var(--airis-accent-iris)]"
        >
          <span className="text-3xl font-light leading-none text-[color:var(--airis-accent-iris)] opacity-90 transition group-hover:opacity-100">
            +
          </span>
          <span className="mt-2 text-[11px] font-medium uppercase tracking-wide">New</span>
        </button>
        {userSpaces.map((s) => (
          <SpaceCard
            key={s.id}
            space={s}
            onOpen={() => void selectSpace(s.id)}
            onDelete={() => onDeleteSpace(s.id, s.name)}
          />
        ))}
      </div>
      {!loading && userSpaces.length === 0 && (
        <p className="mt-6 text-center text-[13px] leading-relaxed text-[color:var(--airis-text-secondary)]">
          Your workspaces land here. Create one, or open a flagship demo above to clone your first copy.
        </p>
      )}
    </section>
  );
}
