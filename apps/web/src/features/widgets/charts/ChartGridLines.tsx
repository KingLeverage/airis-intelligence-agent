import { AIRIS_CHART_THEME } from "@airis/shared";

export function ChartGridLines() {
  const g = AIRIS_CHART_THEME.grid.line;
  return (
    <g opacity={0.9}>
      {[10, 20, 30].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke={g} strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}
