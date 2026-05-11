import { PanelChipRow } from "./PanelChipRow";

/** Discoverable summonable modes — chips row (Phase 1). */
export function PanelsSection(props: {
  spaceActive: boolean;
  /** `toolbar`: compact strip for inside a workspace (not part of the widget canvas). */
  density?: "hero" | "toolbar";
}) {
  return <PanelChipRow {...props} />;
}
