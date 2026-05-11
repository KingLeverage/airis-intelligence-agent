import { AIRIS_CHART_THEME, type WidgetRecord } from "@airis/shared";
import { ChartPanelChrome } from "./ChartPanelChrome";

type Tone = "neutral" | "risk" | "win" | "milestone";

type Ev = { id: string; at: string; title: string; detail?: string; tone?: Tone };

const toneRing: Record<Tone, string> = {
  neutral: "border-slate-500/50 bg-slate-900/40",
  risk: "border-rose-500/45 bg-rose-950/25",
  win: "border-emerald-500/45 bg-emerald-950/20",
  milestone: "border-amber-400/50 bg-amber-950/20",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-slate-400",
  risk: "bg-rose-400",
  win: "bg-emerald-400",
  milestone: "bg-amber-300",
};

export function TimelinePanelWidgetView({ record }: { record: WidgetRecord }) {
  const raw = Array.isArray(record.data.events) ? (record.data.events as Ev[]) : [];
  const subtitle = typeof record.data.subtitle === "string" ? record.data.subtitle.trim() : "";
  const events = [...raw].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-2">
      {subtitle ? <p className={AIRIS_CHART_THEME.typography.subtitle}>{subtitle}</p> : null}
      <ChartPanelChrome>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No events — add events array with id, at, title, optional tone.</p>
        ) : (
          <ul className="relative space-y-3 pl-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-12px)] before:w-px before:bg-slate-700/80">
            {events.map((e) => {
              const tone: Tone =
                e.tone === "risk" || e.tone === "win" || e.tone === "milestone" || e.tone === "neutral"
                  ? e.tone
                  : "neutral";
              return (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[17px] top-2 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${toneDot[tone]}`}
                  />
                  <div className={`rounded-lg border px-3 py-2 ${toneRing[tone]}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-slate-100">{e.title}</p>
                      <time className="shrink-0 font-mono text-[10px] text-slate-500">{e.at}</time>
                    </div>
                    {e.detail ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{e.detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartPanelChrome>
    </div>
  );
}
