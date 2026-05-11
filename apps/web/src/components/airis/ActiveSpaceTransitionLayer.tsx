import type { ReactNode } from "react";

type Props = {
  active: boolean;
  children: ReactNode;
};

/** Subtle depth cue when switching home ↔ space (Phase 1: opacity + scale). */
export function ActiveSpaceTransitionLayer({ active, children }: Props) {
  return (
    <div
      className="airis-motion h-full min-h-0 origin-center transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        opacity: 1,
        transform: active ? "scale(1)" : "scale(0.995)",
      }}
    >
      {children}
    </div>
  );
}
