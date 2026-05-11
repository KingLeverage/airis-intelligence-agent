import { AIRIS_CHART_THEME } from "@airis/shared";
import { buildPieSliceDescriptors, pieSliceFill, PIE_SLICE_STROKE, SERIES_COLORS } from "./chartSvgMath";

type Point = { x: string; y: number; color?: string };

export function AirisPieChart({
  points,
  seriesColor,
  seriesLabel,
}: {
  points: Point[];
  seriesColor?: string;
  seriesLabel?: string;
}) {
  const slices = buildPieSliceDescriptors(points, seriesColor, SERIES_COLORS);
  return (
    <>
      <div className="mx-auto w-full max-w-full px-1">
        <svg viewBox="0 0 100 100" className="aspect-square w-full max-w-full" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="41" fill="rgb(2,6,23)" opacity={0.42} />
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill={s.fill}
              stroke={PIE_SLICE_STROKE}
              strokeWidth="0.65"
              opacity={0.94}
            />
          ))}
        </svg>
      </div>
      <div className={`mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5 ${AIRIS_CHART_THEME.typography.legend}`}>
        {points.map((p, i) => (
          <span key={`${p.x}-${i}`} className="text-[10px] text-slate-300">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{
                background: pieSliceFill(i, p, seriesColor, SERIES_COLORS),
              }}
            />
            <span className="text-slate-400">{p.x}</span>
            <span className="ml-1 font-mono text-slate-100">{p.y}</span>
          </span>
        ))}
      </div>
      {seriesLabel ? <p className="text-center text-[10px] text-slate-500">{seriesLabel}</p> : null}
    </>
  );
}
