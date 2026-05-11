import { STARTER_RESOURCES } from "../data/starterResources";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

type Props = {
  variant: "prominent" | "compact";
  onDismiss: () => void;
};

export function StartFastPanel({ variant, onDismiss }: Props) {
  const compact = variant === "compact";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md ${
        compact ? "mb-6 p-4" : "mb-8 p-5 sm:p-6"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--airis-border-glass)] border-opacity-40 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[color:var(--airis-text-tertiary)]">
            Quick links
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--airis-text-primary)] sm:text-xl">
            Start fast
          </h2>
          <p className="mt-1.5 max-w-lg text-[13px] leading-snug text-[color:var(--airis-text-secondary)]">
            Build, learn, and stay close to the project — flagship demos and your spaces are below.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--airis-border-glass)] text-[color:var(--airis-text-tertiary)] transition hover:border-[color:var(--airis-border-glass-strong)] hover:text-[color:var(--airis-text-secondary)]"
          title="Close"
          aria-label="Close Start fast"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--airis-text-tertiary)]">
          Resources
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STARTER_RESOURCES.map((r) => {
            const title = r.description ? `${r.label} — ${r.description}` : r.label;
            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                title={title}
                className="flex min-h-[2.75rem] items-center justify-between gap-2 rounded-xl border border-[color:var(--airis-border-glass)] bg-[color:rgba(255,255,255,0.04)] px-3 py-2 text-left text-[13px] font-medium text-[color:var(--airis-text-primary)] transition hover:border-[color:var(--airis-border-glass-strong)] hover:bg-[color:rgba(255,255,255,0.06)]"
              >
                <span className="min-w-0 truncate">{r.label}</span>
                <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--airis-text-tertiary)]" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
