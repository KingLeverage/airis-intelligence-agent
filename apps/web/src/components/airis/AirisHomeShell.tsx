import { useMemo } from "react";
import { FeaturedDemoSections } from "../../features/home/components/FeaturedDemoSections";
import { StartFastPanel } from "../../features/home/components/StartFastPanel";
import { useHomePreferences } from "../../features/home/hooks/useHomePreferences";
import { useSpacesStore } from "../../stores/spaces-store";
import { AirisHomeHero } from "./AirisHomeHero";
import { PanelsSection } from "./PanelsSection";
import { SpacesSection } from "./SpacesSection";
import { TopRail } from "./TopRail";

export function AirisHomeShell() {
  const { startFastOpen, setStartFastOpen } = useHomePreferences();
  const spaces = useSpacesStore((s) => s.spaces);
  const openSpaceFromHome = useSpacesStore((s) => s.openSpaceFromHome);

  const demoSpaces = useMemo(() => spaces.filter((s) => s.demo && s.pinned), [spaces]);
  const hasPersonalSpaces = useMemo(() => spaces.some((s) => !s.demo), [spaces]);
  const startFastVariant = hasPersonalSpaces ? "compact" : "prominent";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopRail variant="home" showStartFastReopen={!startFastOpen} onShowStartFast={() => setStartFastOpen(true)} />
      <div className="airis-home-canvas min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:px-8 sm:pb-28 sm:pt-5">
        <div className="mx-auto max-w-3xl">
          <AirisHomeHero />
          {startFastOpen && (
            <StartFastPanel variant={startFastVariant} onDismiss={() => setStartFastOpen(false)} />
          )}
          <FeaturedDemoSections demoSpaces={demoSpaces} onOpenDemo={(id) => void openSpaceFromHome(id)} />
          <SpacesSection />
          <PanelsSection spaceActive={false} />
        </div>
      </div>
    </div>
  );
}
