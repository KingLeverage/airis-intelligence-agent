import { AIRIS_CHART_THEME } from "@airis/shared";
import { normalizeSeries, SERIES_COLORS } from "./chartSvgMath";
import { ChartGridLines } from "./ChartGridLines";

type Series = {
  id: string;
  label: string;
  color?: string;
  points: { x: string; y: number; color?: string }[];
};

export function AirisCartesianChart({
  chartType,
  series,
}: {
  chartType: "line" | "bar" | "area";
  series: Series[];
}) {
  return (
    <>
      <svg viewBox="0 0 100 40" className="h-32 w-full" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="40" fill="transparent" />
        <ChartGridLines />
        {series.map((s, si) => {
          const norm = normalizeSeries(s.points);
          const { lineD, areaD } = norm;
          const stroke = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          if (chartType === "bar" && s.points.length > 0) {
            const span = norm.maxY - norm.minY || 1;
            const groupW = 100 / s.points.length;
            const barW = (groupW / Math.max(1, series.length)) * 0.72;
            return (
              <g key={s.id}>
                {s.points.map((p, i) => {
                  const h = ((p.y - norm.minY) / span) * 28;
                  const gx = (i + 0.5) * groupW;
                  const x = gx - groupW / 2 + si * barW;
                  return (
                    <rect
                      key={`${s.id}-bar-${i}`}
                      x={x}
                      y={34 - h}
                      width={barW}
                      height={h}
                      rx={AIRIS_CHART_THEME.radii.barPx}
                      fill={stroke}
                      opacity={0.94}
                    />
                  );
                })}
              </g>
            );
          }
          if (chartType === "area" && s.points.length > 0) {
            return (
              <path
                key={`${s.id}-area`}
                d={areaD}
                fill={stroke}
                fillOpacity={0.28}
                stroke={stroke}
                strokeWidth={0.85}
              />
            );
          }
          return (
            <path
              key={s.id}
              d={lineD}
              fill="none"
              stroke={stroke}
              strokeWidth={0.95}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div
        className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-800/60 pt-2 ${AIRIS_CHART_THEME.typography.legend}`}
      >
        {series.map((s, si) => (
          <span key={s.id} className="text-[10px] text-slate-400">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length] }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
