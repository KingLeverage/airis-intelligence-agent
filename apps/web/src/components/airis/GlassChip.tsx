import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
};

export function GlassChip({ children, onClick, active, disabled, title, className = "" }: Props) {
  const base =
    "inline-flex items-center gap-1.5 rounded-[var(--airis-radius-pill)] border px-3 py-1.5 text-xs font-medium airis-transition-surface";
  const idle =
    "border-[color:var(--airis-border-glass)] bg-[color:var(--airis-surface-glass-3)] text-[color:var(--airis-text-secondary)] backdrop-blur-[var(--airis-blur-soft)] hover:border-[color:var(--airis-border-glass-strong)] hover:text-[color:var(--airis-text-primary)]";
  const on = "border-[color:var(--airis-border-focus)] bg-[color:var(--airis-surface-tint-blue)] text-[color:var(--airis-text-primary)] shadow-[var(--airis-shadow-glow)]";
  const dis = "cursor-not-allowed opacity-40 hover:border-[color:var(--airis-border-glass)] hover:text-[color:var(--airis-text-secondary)]";
  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={`${base} ${active ? on : idle} ${disabled ? dis : ""} ${className}`.trim()}
      >
        {children}
      </button>
    );
  }
  return <span className={`${base} ${active ? on : idle} ${className}`.trim()}>{children}</span>;
}
