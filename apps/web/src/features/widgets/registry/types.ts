import type { ComponentType } from "react";
import type { WidgetKind, WidgetLayoutPosition, WidgetRecord } from "@airis/shared";

export type WidgetStyleVariant = "glass" | "midnight" | "contrast";

export type WidgetDefinition = {
  kind: WidgetKind;
  label: string;
  description: string;
  defaultSize: Pick<WidgetLayoutPosition, "w" | "h">;
  defaultConfig: Record<string, unknown>;
  renderer: ComponentType<{ record: WidgetRecord }>;
  settingsSchema: Array<"title" | "dataSource" | "styleVariant" | "displayMode" | "configJson">;
  styleVariants: WidgetStyleVariant[];
};
