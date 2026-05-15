import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSpacesStore } from "../../stores/spaces-store";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * In-app name entry for new workspaces. Electron often does not implement
 * `window.prompt`, which made the dashed “New” card appear to do nothing.
 */
export function CreateWorkspaceDialog({ open, onClose }: Props) {
  const createSpace = useSpacesStore((s) => s.createSpace);
  const [name, setName] = useState("New workspace");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("New workspace");
    setLocalError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setLocalError(null);
    try {
      await createSpace(n);
      onClose();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[color:var(--airis-border-glass-strong)] bg-[color:rgba(8,16,26,0.98)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="airis-create-workspace-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="airis-create-workspace-title" className="text-sm font-semibold text-[color:var(--airis-text-primary)]">
          New workspace
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-[color:var(--airis-text-tertiary)]">
          Choose a display name. You can rename later from the workspace.
        </p>
        <label className="mt-4 block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--airis-text-tertiary)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="mt-1 w-full rounded-lg border border-[color:var(--airis-border-glass)] bg-[color:rgba(6,12,22,0.9)] px-3 py-2 text-[13px] text-[color:var(--airis-text-primary)] outline-none focus:border-[color:rgba(134,183,255,0.45)]"
            autoFocus
          />
        </label>
        {localError ? (
          <p className="mt-2 text-[11px] text-rose-300/95">{localError}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-[color:var(--airis-border-glass)] px-3 py-1.5 text-[11px] text-[color:var(--airis-text-secondary)] hover:bg-[color:rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void submit()}
            className="inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border border-[color:rgba(134,183,255,0.45)] bg-[color:rgba(134,183,255,0.15)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--airis-accent-iris)] hover:bg-[color:rgba(134,183,255,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" aria-hidden />
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
