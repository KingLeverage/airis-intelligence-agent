import { useChromeStore } from "../../stores/chrome-store";
import { AirisOrb } from "./AirisOrb";

/**
 * Primary focal block on Home — establishes AIRIS as the intelligence surface before scrolling content.
 */
export function AirisHomeHero() {
  const setAirisExpanded = useChromeStore((s) => s.setAirisExpanded);

  return (
    <section className="airis-home-hero relative mx-auto max-w-lg px-2 pb-6 pt-1 text-center sm:max-w-xl sm:pb-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(134, 183, 255, 0.14), transparent 65%), radial-gradient(ellipse 50% 40% at 50% 80%, rgba(164, 140, 255, 0.08), transparent 60%)",
        }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--airis-accent-iris)]">
        AIRIS
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--airis-text-primary)] sm:text-[1.75rem] sm:leading-tight">
        A calm field for spatial intelligence
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-[color:var(--airis-text-secondary)]">
        The orb below is your command surface — drag to place it, tap to speak. Open a workspace, then
        return here anytime; Home stays your map of fields and links.
      </p>

      <div className="mt-8 flex flex-col items-center gap-5">
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-2xl"
            style={{
              background: "radial-gradient(circle, rgba(134, 183, 255, 0.25) 0%, transparent 70%)",
            }}
          />
          <div className="relative flex scale-110 justify-center sm:scale-125">
            <div className="rounded-full border border-[color:var(--airis-border-glass-strong)] bg-[color:rgba(8,16,26,0.5)] p-1 shadow-[0_0_40px_rgba(134,183,255,0.15)]">
              <AirisOrb className="h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setAirisExpanded(true)}
            className="rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass-strong)] bg-[color:rgba(134,183,255,0.12)] px-5 py-2 text-xs font-semibold text-[color:var(--airis-accent-iris)] shadow-[var(--airis-shadow-soft)] backdrop-blur-md transition hover:bg-[color:rgba(134,183,255,0.2)]"
          >
            Open command
          </button>
          <p className="max-w-xs text-[11px] leading-snug text-[color:var(--airis-text-tertiary)]">
            Command is richest inside a workspace — start from a Flagship demo or your own space below.
          </p>
        </div>
      </div>
    </section>
  );
}
