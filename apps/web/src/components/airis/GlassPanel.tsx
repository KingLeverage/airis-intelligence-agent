import type { ReactNode } from "react";

type Tier = "primary" | "secondary" | "ghost";

const tierClass: Record<Tier, string> = {
  primary: "airis-glass-1",
  secondary: "airis-glass-2",
  ghost: "airis-glass-3",
};

type Props = {
  children: ReactNode;
  className?: string;
  tier?: Tier;
  as?: "div" | "section" | "aside";
};

export function GlassPanel({ children, className = "", tier = "secondary", as: Tag = "div" }: Props) {
  return <Tag className={`${tierClass[tier]} ${className}`.trim()}>{children}</Tag>;
}
