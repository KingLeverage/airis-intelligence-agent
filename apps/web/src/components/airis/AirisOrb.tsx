import { useChromeStore } from "../../stores/chrome-store";

type Props = {
  className?: string;
};

/**
 * Living intelligence node — iris / aperture metaphor (not a mascot character).
 */
export function AirisOrb({ className = "" }: Props) {
  const orbState = useChromeStore((s) => s.orbState);
  return (
    <div
      className={`airis-orb airis-motion relative flex h-14 w-14 shrink-0 items-center justify-center ${className}`.trim()}
      data-state={orbState}
      aria-hidden
    >
      <div className="airis-orb-halo pointer-events-none absolute inset-0 rounded-full" />
      <div className="airis-orb-ring pointer-events-none absolute inset-[3px] rounded-full" />
      <div className="airis-orb-core pointer-events-none h-5 w-5 rounded-full" />
    </div>
  );
}
