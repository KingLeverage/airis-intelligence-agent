import { useSessionStore } from "../../stores/session-store";

/**
 * Short status line near the AIRIS command surface while a chat turn is in flight.
 */
export function InlineResponseBubbles() {
  const runStatus = useSessionStore((s) => s.runStatus);
  if (runStatus !== "running") return null;
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/55 to-slate-950/50 px-3.5 py-2 text-[11px] leading-snug text-cyan-100/90 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
      <span className="mr-1.5 inline-block animate-pulse">✦</span>
      Working on it — browser and widgets refresh in a beat…
    </div>
  );
}
