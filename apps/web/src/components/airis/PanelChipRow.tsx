import { Link } from "react-router-dom";
import { GlassChip } from "./GlassChip";
import { useChromeStore, type PanelId } from "../../stores/chrome-store";

type Props = {
  spaceActive: boolean;
  density?: "hero" | "toolbar";
};

export function PanelChipRow({ spaceActive, density = "hero" }: Props) {
  const openPanel = useChromeStore((s) => s.openPanel);
  const togglePanel = useChromeStore((s) => s.togglePanel);

  const needsWorkspace: Partial<Record<PanelId, true>> = { snapshots: true, skills: true, exports: true };

  const chip = (id: PanelId, label: string) => {
    const disabled = Boolean(needsWorkspace[id] && !spaceActive);
    return (
      <GlassChip
        active={openPanel === id}
        disabled={disabled}
        title={disabled ? "Open a workspace for this panel" : undefined}
        onClick={() => togglePanel(id)}
      >
        {label}
      </GlassChip>
    );
  };

  if (density === "toolbar") {
    return (
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--airis-text-tertiary)]">
          Panels
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {chip("agent", "Agent")}
          {chip("browser", "Browser")}
          {chip("snapshots", "Time travel")}
          {chip("skills", "Skills")}
          {chip("exports", "Exports")}
        </div>
        <span
          className="hidden h-4 w-px shrink-0 bg-[color:var(--airis-border-glass)] sm:block"
          aria-hidden
        />
        <Link
          to="/admin/recovery"
          className="inline-flex shrink-0 items-center rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass)] bg-[color:var(--airis-surface-glass-3)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--airis-accent-gold)] backdrop-blur-[var(--airis-blur-soft)] hover:border-[color:var(--airis-border-glass-strong)]"
        >
          Recovery
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-12 sm:mt-14">
      <h2 className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--airis-text-tertiary)]">
        Panels &amp; tools
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-[12px] leading-relaxed text-[color:var(--airis-text-tertiary)]">
        Agent and Browser work from Home; Time travel, Skills, and Exports need an open workspace.
      </p>
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--airis-text-tertiary)]">
            Inside a workspace
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            {chip("agent", "Agent")}
            {chip("browser", "Browser")}
            {chip("snapshots", "Time travel")}
            {chip("skills", "Skills")}
            {chip("exports", "Exports")}
          </div>
        </div>
        <div>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--airis-text-tertiary)]">
            Always available
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/admin/recovery"
              className="inline-flex items-center rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass)] bg-[color:var(--airis-surface-glass-3)] px-3 py-1.5 text-xs font-medium text-[color:var(--airis-accent-gold)] backdrop-blur-[var(--airis-blur-soft)] hover:border-[color:var(--airis-border-glass-strong)]"
            >
              Recovery
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
