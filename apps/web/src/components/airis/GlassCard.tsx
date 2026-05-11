import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export function GlassCard({ children, className = "", interactive }: Props) {
  return (
    <div
      className={`airis-glass-2 rounded-[var(--airis-radius-md)] border border-[color:var(--airis-border-glass)] p-4 shadow-[var(--airis-shadow-soft)] ${interactive ? "airis-transition-surface cursor-pointer hover:border-[color:var(--airis-border-glass-strong)]" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
