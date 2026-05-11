import { v4 as uuid } from "uuid";
import {
  DEMO_SPACE_TEMPLATES,
  FLAGSHIP_DEMO_TEMPLATE_IDS,
  expandDashboardRecipe,
  parseWidgetPayload,
  type DashboardRecipe,
  type SpaceMeta,
  type WidgetKind,
  type WidgetRecord,
} from "@airis/shared";
import * as store from "./space-store.js";

function normalizeWidgetData(kind: WidgetKind, payload: Record<string, unknown>): Record<string, unknown> {
  const data = parseWidgetPayload(kind, payload);
  return data as Record<string, unknown>;
}

async function applyDashboardRecipe(spaceId: string, recipe: DashboardRecipe, userId: string): Promise<void> {
  const now = new Date().toISOString();
  for (const b of expandDashboardRecipe(recipe)) {
    const wid = uuid();
    const data = normalizeWidgetData(b.kind, b.payload as Record<string, unknown>);
    const rec: WidgetRecord = {
      id: wid,
      spaceId,
      kind: b.kind,
      title: b.title,
      createdAt: now,
      updatedAt: now,
      version: 1,
      data,
      layout: b.layout,
      status: "ok",
      dataSource: b.dataSource,
    };
    await store.saveWidget(rec, userId);
  }
}

/**
 * Idempotent: creates one folder per template when no space with matching `demoTemplateId` exists.
 */
export async function seedDemoSpacesIfMissing(userId: string): Promise<void> {
  const existing = await store.listSpacesMeta(userId);
  const have = new Set(
    existing.map((m) => m.demoTemplateId).filter((x): x is string => typeof x === "string" && x.length > 0),
  );

  for (const t of DEMO_SPACE_TEMPLATES) {
    if (have.has(t.templateId)) continue;
    try {
      const created = await store.createSpace(t.name, userId);
      const meta: SpaceMeta = {
        ...created,
        name: t.name,
        demo: true,
        pinned: true,
        cloneOnOpen: true,
        demoTemplateId: t.templateId,
        demoDescription: t.description,
        demoContentRevision: t.contentRevision,
      };
      await store.writeSpaceMeta(meta, userId);
      await applyDashboardRecipe(created.id, t.recipe, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[seed-demo-spaces] skip template ${t.templateId}: ${msg}`);
    }
  }
}

/**
 * Refreshes `demoDescription` + `demoContentRevision` from `DEMO_SPACE_TEMPLATES` when the template
 * `contentRevision` is newer. Does **not** change `name` (users may rename demos), and never touches widgets.
 */
export async function syncDemoSpaceMetadataFromTemplates(userId: string): Promise<void> {
  const existing = await store.listSpacesMeta(userId);
  for (const m of existing) {
    if (!m.demo || !m.demoTemplateId) continue;
    const t = DEMO_SPACE_TEMPLATES.find((x) => x.templateId === m.demoTemplateId);
    if (!t) continue;
    const targetRev = t.contentRevision;
    const currentRev = m.demoContentRevision ?? 0;
    if (currentRev >= targetRev) continue;

    const now = new Date().toISOString();
    const next: SpaceMeta = {
      ...m,
      demoDescription: t.description,
      demoContentRevision: targetRev,
      updatedAt: now,
      version: m.version + 1,
    };
    try {
      await store.writeSpaceMeta(next, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[seed-demo-spaces] sync skip space ${m.id} (${m.demoTemplateId}): ${msg}`);
    }
  }
}

export type ReapplyFlagshipDemoResult = {
  templateId: string;
  status: "applied" | "skipped" | "not_found" | "not_demo" | "renamed_block";
  detail?: string;
  widgetsRemoved?: number;
};

/**
 * Deletes all widgets in a seeded flagship demo and re-applies the current `expandDashboardRecipe` output.
 * **Never touches non-demo spaces.** Skips renamed demos unless `force` is true (dev escape hatch only).
 */
export async function reapplyFlagshipDemoRecipes(
  userId: string,
  opts: { templateIds?: string[]; force?: boolean },
): Promise<ReapplyFlagshipDemoResult[]> {
  const requested =
    opts.templateIds && opts.templateIds.length > 0
      ? opts.templateIds.filter((id) => FLAGSHIP_DEMO_TEMPLATE_IDS.includes(id))
      : [...FLAGSHIP_DEMO_TEMPLATE_IDS];

  const out: ReapplyFlagshipDemoResult[] = [];

  for (const templateId of requested) {
    const t = DEMO_SPACE_TEMPLATES.find((x) => x.templateId === templateId);
    if (!t?.flagship) {
      out.push({ templateId, status: "skipped", detail: "not a flagship template" });
      continue;
    }

    const existing = await store.listSpacesMeta(userId);
    const meta = existing.find((m) => m.demoTemplateId === templateId);
    if (!meta) {
      out.push({ templateId, status: "not_found" });
      continue;
    }
    if (!meta.demo) {
      out.push({ templateId, status: "not_demo" });
      continue;
    }
    if (meta.name !== t.name && !opts.force) {
      out.push({
        templateId,
        status: "renamed_block",
        detail: "Demo was renamed; omit force to preserve user intent, or pass force:true in dev to re-apply widgets",
      });
      continue;
    }

    const removed = await store.deleteAllWidgetsInSpace(meta.id, userId);
    await applyDashboardRecipe(meta.id, t.recipe, userId);
    out.push({ templateId, status: "applied", widgetsRemoved: removed });
  }

  return out;
}
