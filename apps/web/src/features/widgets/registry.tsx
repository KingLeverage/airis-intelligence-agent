import type { WidgetRecord } from "@airis/shared";
import { rendererForKind } from "./registry/widgetRegistry";

export function WidgetRenderer({ record }: { record: WidgetRecord }) {
  const C = rendererForKind(record.kind);
  if (!C) {
    return <p className="text-sm text-amber-400">Unknown widget kind: {record.kind}</p>;
  }
  return <C record={record} />;
}
