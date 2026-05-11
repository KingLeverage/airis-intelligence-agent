import { AIRIS_CHART_THEME, type WidgetRecord } from "@airis/shared";
import { ChartPanelChrome } from "./ChartPanelChrome";

type Cell = { r: number; c: number; v: number };

function heatColor(t: number, scale: "airis" | "mono"): string {
  const x = Math.max(0, Math.min(1, t));
  if (scale === "mono") return `rgba(148,163,184,${0.12 + x * 0.55})`;
  const hue = 200 - x * 130;
  return `hsla(${hue}, 72%, ${36 + x * 14}%, ${0.5 + x * 0.42})`;
}

export function HeatmapPanelWidgetView({ record }: { record: WidgetRecord }) {
  const rowLabels = Array.isArray(record.data.rowLabels) ? (record.data.rowLabels as string[]) : [];
  const colLabels = Array.isArray(record.data.colLabels) ? (record.data.colLabels as string[]) : [];
  const cells = Array.isArray(record.data.cells) ? (record.data.cells as Cell[]) : [];
  const subtitle = typeof record.data.subtitle === "string" ? record.data.subtitle.trim() : "";
  const valueSuffix = typeof record.data.valueSuffix === "string" ? record.data.valueSuffix : "";
  const colorScale = record.data.colorScale === "mono" ? "mono" : "airis";

  const vals = cells.map((c) => c.v);
  const vmin = vals.length ? Math.min(...vals) : 0;
  const vmax = vals.length ? Math.max(...vals) : 1;
  const span = vmax - vmin || 1;

  const map = new Map<string, number>();
  for (const c of cells) {
    map.set(`${c.r},${c.c}`, c.v);
  }

  return (
    <div className="space-y-2">
      {subtitle ? <p className={AIRIS_CHART_THEME.typography.subtitle}>{subtitle}</p> : null}
      <ChartPanelChrome>
        {rowLabels.length === 0 || colLabels.length === 0 ? (
          <p className="text-sm text-slate-500">Add rowLabels, colLabels, and cells {`{ r, c, v }`}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[200px] border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-slate-800/60 bg-slate-950/80 p-1.5 text-left font-medium text-slate-500" />
                  {colLabels.map((cl, j) => (
                    <th
                      key={`c-${j}`}
                      className="border border-slate-800/60 bg-slate-950/80 p-1.5 text-center font-medium text-slate-400"
                    >
                      {cl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowLabels.map((rl, ri) => (
                  <tr key={`r-${ri}`}>
                    <td className="border border-slate-800/60 bg-slate-950/60 p-1.5 font-medium text-slate-400">
                      {rl}
                    </td>
                    {colLabels.map((_col, ci) => {
                      const v = map.get(`${ri},${ci}`);
                      const t = v === undefined ? 0 : (v - vmin) / span;
                      const bg = heatColor(t, colorScale);
                      return (
                        <td
                          key={`${ri}-${ci}`}
                          className="border border-slate-800/50 p-2 text-center font-mono text-slate-100"
                          style={{ background: bg }}
                          title={v === undefined ? "—" : String(v)}
                        >
                          {v === undefined ? "—" : `${v}${valueSuffix}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartPanelChrome>
    </div>
  );
}
