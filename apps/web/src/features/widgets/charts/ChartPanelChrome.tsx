import { AIRIS_CHART_THEME } from "@airis/shared";
import type { ReactNode } from "react";

export function ChartPanelChrome({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border p-3 backdrop-blur-[2px]"
      style={{
        borderColor: AIRIS_CHART_THEME.surface.panelBorder,
        background: `linear-gradient(180deg, rgba(15,23,42,0.92) 0%, ${AIRIS_CHART_THEME.surface.panelBg} 55%, rgba(2,6,23,0.88) 100%)`,
        boxShadow: `inset 0 1px 0 0 ${AIRIS_CHART_THEME.surface.panelInsetHighlight}, 0 0 0 1px ${AIRIS_CHART_THEME.surface.panelRing}`,
      }}
    >
      {children}
    </div>
  );
}
