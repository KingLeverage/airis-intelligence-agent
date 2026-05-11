import { CliCatalogWidgetView } from "../../CliCatalogWidgetView";
import type { WidgetDefinition } from "../types";

export const cliCatalogWidgetDefinition: WidgetDefinition = {
  kind: "cli-catalog",
  label: "CLI catalog",
  description: "Allowlisted Printing Press / host CLI shortcuts (operator Run).",
  defaultSize: { w: 6, h: 14 },
  defaultConfig: { recentRuns: [] },
  renderer: CliCatalogWidgetView,
  settingsSchema: ["title", "styleVariant", "configJson"],
  styleVariants: ["glass", "midnight", "contrast"],
};
