import type { WidgetRecord } from "@airis/shared";

export { ChartPanelWidgetView } from "./charts/ChartPanelWidgetView";
export { HeatmapPanelWidgetView } from "./charts/HeatmapPanelWidgetView";
export { TimelinePanelWidgetView } from "./charts/TimelinePanelWidgetView";

function panelClass(theme?: string) {
  if (theme === "contrast") return "border-slate-600 bg-slate-900";
  if (theme === "midnight") return "border-indigo-950/80 bg-indigo-950/40";
  return "border-slate-800/90 bg-slate-950/50";
}

export function StatTickerWidgetView({ record }: { record: WidgetRecord }) {
  const rc = record.renderConfig;
  const theme = rc && "themeVariant" in rc ? String(rc.themeVariant) : "glass";
  const symbols = Array.isArray(record.data.symbols)
    ? (record.data.symbols as { symbol: string; price?: string; changePct?: number; hint?: string }[])
    : [];
  const subtitle = typeof record.data.subtitle === "string" ? record.data.subtitle : null;
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${panelClass(theme)}`}>
      {subtitle ? <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{subtitle}</p> : null}
      <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
        {symbols.length === 0 ? (
          <span className="text-sm text-slate-500">No symbols — add via widget data</span>
        ) : (
          symbols.map((s, i) => (
            <div
              key={`${s.symbol}-${i}`}
              className="flex min-w-[7rem] items-baseline gap-2 border-r border-slate-800/80 pr-3 last:border-0 last:pr-0"
            >
              <span className="text-xs font-semibold text-cyan-300/90">{s.symbol}</span>
              {s.price != null && s.price !== "" ? (
                <span className="font-mono text-sm text-slate-100">{s.price}</span>
              ) : null}
              {typeof s.changePct === "number" ? (
                <span
                  className={`text-xs font-medium ${
                    s.changePct > 0 ? "text-emerald-400/90" : s.changePct < 0 ? "text-rose-400/90" : "text-slate-400"
                  }`}
                >
                  {s.changePct > 0 ? "+" : ""}
                  {s.changePct.toFixed(2)}%
                </span>
              ) : null}
              {s.hint ? <span className="text-[10px] text-slate-500">{s.hint}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function NewsFeedWidgetView({ record }: { record: WidgetRecord }) {
  const items = Array.isArray(record.data.items)
    ? (record.data.items as {
        id: string;
        title: string;
        source?: string;
        url?: string;
        publishedAt?: string;
        summary?: string;
      }[])
    : [];
  const max =
    typeof record.data.maxItems === "number" ? Math.min(50, record.data.maxItems) : items.length;
  const showTs = record.data.showTimestamps === true;
  const slice = items.slice(0, max);

  return (
    <ul className="space-y-2">
      {slice.length === 0 ? (
        <li className="text-sm text-slate-500">No items yet</li>
      ) : (
        slice.map((it) => (
          <li
            key={it.id}
            className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug text-slate-100">{it.title}</p>
              {it.source ? (
                <span className="shrink-0 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  {it.source}
                </span>
              ) : null}
            </div>
            {showTs && it.publishedAt ? (
              <p className="mt-1 text-[10px] text-slate-500">{it.publishedAt}</p>
            ) : null}
            {it.summary ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{it.summary}</p> : null}
            {it.url ? (
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] text-cyan-400/90 hover:text-cyan-300"
              >
                Open link
              </a>
            ) : null}
          </li>
        ))
      )}
    </ul>
  );
}

export function MetricGridWidgetView({ record }: { record: WidgetRecord }) {
  const metrics = Array.isArray(record.data.metrics)
    ? (record.data.metrics as {
        id: string;
        label: string;
        value: string;
        delta?: string;
        trend?: "up" | "down" | "flat";
      }[])
    : [];
  const cols = record.data.columns === 3 || record.data.columns === 4 ? record.data.columns : 2;
  const gridCls = cols === 4 ? "grid-cols-2 sm:grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid gap-2 ${gridCls}`}>
      {metrics.length === 0 ? (
        <p className="text-sm text-slate-500">No metrics</p>
      ) : (
        metrics.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-indigo-950/25 px-2.5 py-2 ring-1 ring-cyan-500/10"
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</div>
            <div className="mt-0.5 font-mono text-lg text-slate-50">{m.value}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {m.delta ? <span className="text-slate-400">{m.delta}</span> : null}
              {m.trend === "up" ? <span className="text-emerald-400/90">▲</span> : null}
              {m.trend === "down" ? <span className="text-rose-400/90">▼</span> : null}
              {m.trend === "flat" ? <span className="text-slate-500">■</span> : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function ResearchCardWidgetView({ record }: { record: WidgetRecord }) {
  const summary = typeof record.data.summary === "string" ? record.data.summary : "";
  const bullets = Array.isArray(record.data.bullets) ? (record.data.bullets as string[]) : [];
  const tags = Array.isArray(record.data.tags) ? (record.data.tags as string[]) : [];
  const citations = Array.isArray(record.data.citations)
    ? (record.data.citations as { label: string; url?: string }[])
    : [];

  return (
    <div className="space-y-3 text-sm">
      {summary ? <p className="leading-relaxed text-slate-200">{summary}</p> : null}
      {bullets.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-400">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {citations.length > 0 ? (
        <div className="border-t border-slate-800/80 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Sources</div>
          <ul className="mt-1 space-y-1">
            {citations.map((c, i) => (
              <li key={i} className="text-xs text-cyan-400/80">
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
                    {c.label}
                  </a>
                ) : (
                  c.label
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function isSafeHttpsAvatarUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function ComparisonPanelWidgetView({ record }: { record: WidgetRecord }) {
  const entities = Array.isArray(record.data.entities)
    ? (record.data.entities as {
        id: string;
        label: string;
        avatarUrl?: string;
        metrics: { key: string; value: string }[];
      }[])
    : [];
  const highlight = record.data.highlightDiff === true;
  const keys = entities[0]?.metrics.map((m) => m.key) ?? [];
  const hasAvatar = entities.some((e) => isSafeHttpsAvatarUrl(e.avatarUrl));
  const portraitRaw = record.data.headerPortraitStyle;
  const portraitStyle: "cutout" | "circle" | "none" =
    portraitRaw === "cutout" || portraitRaw === "circle" || portraitRaw === "none"
      ? portraitRaw
      : hasAvatar
        ? "cutout"
        : "none";

  const portraitImgClass =
    portraitStyle === "circle"
      ? "h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/75 ring-offset-2 ring-offset-slate-950"
      : portraitStyle === "cutout"
        ? "h-14 w-14 shrink-0 rounded-full object-cover shadow-[0_4px_18px_rgba(0,0,0,0.55)] outline outline-[3px] outline-offset-0 outline-white"
        : "h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-600/80";

  return (
    <div className="overflow-x-auto">
      {entities.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing to compare</p>
      ) : (
        <table className="w-full min-w-[200px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-2 font-medium">Metric</th>
              {entities.map((e) => (
                <th key={e.id} className="min-w-[6.5rem] px-2 py-2 font-medium text-slate-300">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {isSafeHttpsAvatarUrl(e.avatarUrl) ? (
                      <img
                        src={e.avatarUrl}
                        alt=""
                        className={portraitImgClass}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(ev) => {
                          ev.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : null}
                    <span className="text-[11px] font-semibold normal-case leading-snug tracking-normal text-slate-200">
                      {e.label}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const vals = entities.map((e) => e.metrics.find((m) => m.key === key)?.value ?? "—");
              const distinct = new Set(vals).size;
              const diff = highlight && distinct > 1;
              return (
                <tr key={key} className="border-b border-slate-800/60">
                  <td className="py-1.5 pr-2 text-slate-400">{key}</td>
                  {vals.map((v, i) => (
                    <td
                      key={`${key}-${i}`}
                      className={`px-2 py-1.5 font-mono text-slate-100 ${diff ? "bg-amber-950/20 text-amber-100/90" : ""}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
