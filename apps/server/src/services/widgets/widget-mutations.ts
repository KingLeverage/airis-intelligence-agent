import { z } from "zod";
import { v4 as uuid } from "uuid";
import {
  WidgetDataSourceConfigSchema,
  WidgetKindSchema,
  WidgetRecordSchema,
  createDefaultWidgetData,
  parseWidgetPayload,
  DEFAULT_WIDGET_LAYOUT,
  type WidgetRecord,
} from "@airis/shared";
import * as store from "../../persistence/space-store.js";
import { snapshotAfterMutation } from "../../snapshots/hooks.js";
import { mergeBundledSkillIntoCliCatalogData } from "../cli-tools/attach-bundled-cli-skill.js";

const CreateWidgetBodySchema = z.object({
  kind: WidgetKindSchema,
  title: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  layout: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
    })
    .optional(),
  renderConfig: z.record(z.unknown()).optional(),
  authoringNote: z.string().optional(),
  dataSource: WidgetDataSourceConfigSchema.nullable().optional(),
});

const PatchWidgetBodySchema = z.object({
  title: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  renderConfig: z.record(z.unknown()).optional(),
  authoringNote: z.string().optional(),
  dataSource: WidgetDataSourceConfigSchema.optional(),
  status: z.enum(["ok", "disabled", "error"]).optional(),
  disabled: z.boolean().optional(),
  layout: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
    })
    .optional(),
});

export function parseCreateWidgetBody(body: unknown) {
  return CreateWidgetBodySchema.safeParse(body);
}

export function parsePatchWidgetBody(body: unknown) {
  return PatchWidgetBodySchema.safeParse(body);
}

export async function createWidgetForSpace(
  spaceId: string,
  body: unknown,
  userId: string,
): Promise<{ ok: true; widget: WidgetRecord } | { ok: false; code: string; message: string }> {
  const p = CreateWidgetBodySchema.safeParse(body);
  if (!p.success) return { ok: false, code: "invalid_body", message: p.error.message };

  let data: Record<string, unknown> =
    p.data.data != null && Object.keys(p.data.data).length > 0
      ? (parseWidgetPayload(p.data.kind, p.data.data) as Record<string, unknown>)
      : createDefaultWidgetData(p.data.kind);

  if (p.data.kind === "cli-catalog") {
    data = mergeBundledSkillIntoCliCatalogData(data);
  }

  const now = new Date().toISOString();
  const id = uuid();
  const layout = p.data.layout ?? DEFAULT_WIDGET_LAYOUT;
  const record: WidgetRecord = WidgetRecordSchema.parse({
    id,
    spaceId,
    kind: p.data.kind,
    title: p.data.title,
    createdAt: now,
    updatedAt: now,
    version: 1,
    data,
    layout,
    renderConfig: p.data.renderConfig,
    status: "ok",
    authoringNote: p.data.authoringNote,
    dataSource: p.data.dataSource,
  });
  await store.saveWidget(record, userId);
  await snapshotAfterMutation(spaceId, userId, `widget.create:${p.data.kind}`, [id]);
  return { ok: true, widget: record };
}

export async function updateWidgetForSpace(
  spaceId: string,
  widgetId: string,
  body: unknown,
  userId: string,
): Promise<
  | { ok: true; widget: WidgetRecord }
  | { ok: false; code: "invalid_body" | "not_found"; message: string }
> {
  const parsed = PatchWidgetBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, code: "invalid_body", message: parsed.error.message };

  const existing = await store.getWidget(spaceId, widgetId, userId);
  if (!existing) return { ok: false, code: "not_found", message: "Widget not found" };

  let status = existing.status;
  if (parsed.data.disabled === true) status = "disabled";
  if (parsed.data.status) status = parsed.data.status;

  let nextData = existing.data;
  if (parsed.data.data) {
    nextData = { ...existing.data, ...parsed.data.data };
    parseWidgetPayload(existing.kind, nextData as Record<string, unknown>);
  }

  const nextLayout = parsed.data.layout
    ? { ...existing.layout, ...parsed.data.layout }
    : existing.layout;

  const next: WidgetRecord = {
    ...existing,
    title: parsed.data.title ?? existing.title,
    data: nextData,
    layout: nextLayout,
    renderConfig: parsed.data.renderConfig
      ? { ...(existing.renderConfig ?? {}), ...parsed.data.renderConfig }
      : existing.renderConfig,
    authoringNote: parsed.data.authoringNote ?? existing.authoringNote,
    dataSource:
      parsed.data.dataSource === null
        ? undefined
        : (parsed.data.dataSource ?? existing.dataSource),
    status,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
    lastError: undefined,
  };
  await store.saveWidget(next, userId);
  await snapshotAfterMutation(spaceId, userId, `widget.update:${widgetId}`, [widgetId]);
  return { ok: true, widget: next };
}

export async function deleteWidgetForSpace(
  spaceId: string,
  widgetId: string,
  userId: string,
): Promise<boolean> {
  const existing = await store.getWidget(spaceId, widgetId, userId);
  if (!existing) return false;
  await store.deleteWidgetFile(spaceId, widgetId, userId);
  await snapshotAfterMutation(spaceId, userId, `widget.delete:${widgetId}`, [widgetId]);
  return true;
}
