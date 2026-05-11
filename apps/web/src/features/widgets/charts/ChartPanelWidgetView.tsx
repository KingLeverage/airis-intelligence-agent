import { AIRIS_CHART_THEME, type WidgetRecord } from "@airis/shared";
import { AirisCartesianChart } from "./AirisCartesianChart";
import { AirisPieChart } from "./AirisPieChart";
import { ChartPanelChrome } from "./ChartPanelChrome";

export function ChartPanelWidgetView({ record }: { record: WidgetRecord }) {
  const chartType =
    record.data.chartType === "bar" ||
    record.data.chartType === "area" ||
    record.data.chartType === "line" ||
    record.data.chartType === "pie"
      ? record.data.chartType
      : "line";
  const series = Array.isArray(record.data.series)
    ? (record.data.series as {
        id: string;
        label: string;
        color?: string;
        points: { x: string; y: number; color?: string }[];
      }[])
    : [];
  const yLabel = typeof record.data.yLabel === "string" ? record.data.yLabel : null;
  const subtitle = typeof record.data.subtitle === "string" ? record.data.subtitle.trim() : "";
  const comparisonMode = record.data.comparisonMode === true;
  const pieSeries = chartType === "pie" ? series[0] : null;
  const piePoints = pieSeries?.points?.length ? pieSeries.points : null;
  const cartesianType: "line" | "bar" | "area" =
    chartType === "bar" || chartType === "area" || chartType === "line" ? chartType : "line";

  return (
    <div className="space-y-2">
      {subtitle ? <p className={AIRIS_CHART_THEME.typography.subtitle}>{subtitle}</p> : null}
      {yLabel ? (
        <div className={`${AIRIS_CHART_THEME.typography.yLabel} text-slate-500`}>{yLabel}</div>
      ) : null}
      {comparisonMode && chartType !== "pie" ? (
        <p className="text-[10px] text-slate-500">Comparison mode — multiple series overlaid</p>
      ) : null}
      <ChartPanelChrome>
        {chartType === "pie" && piePoints ? (
          <AirisPieChart points={piePoints} seriesColor={pieSeries?.color} seriesLabel={pieSeries?.label} />
        ) : (
          <AirisCartesianChart chartType={cartesianType} series={series} />
        )}
      </ChartPanelChrome>
    </div>
  );
}
