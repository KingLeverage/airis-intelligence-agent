import type { WidgetKind } from "../schemas/widget.js";
import { WidgetKindSchema } from "../schemas/widget.js";

/**
 * Single source of truth: derived from `WidgetKindSchema`.
 * When adding a kind, update `schemas/widget.ts` + `widget-registry.ts` + web `registry.tsx`.
 */
export const WIDGET_KINDS = Object.values(WidgetKindSchema.enum) as WidgetKind[];

export type { WidgetKind };
