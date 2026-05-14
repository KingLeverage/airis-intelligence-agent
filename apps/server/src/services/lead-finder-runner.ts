import type { FastifyBaseLogger } from "fastify";
import { defaultLayoutForKind, nudgeLayoutBelowConflicts, parseWidgetPayload } from "@airis/shared";
import { probeNativeBrowserViewReady } from "../browser/native-browser-prime.js";
import { performScrapeMaps, type PerformScrapeMapsBusinessRow } from "../routes/browser.js";
import { createWidgetForSpace, updateWidgetForSpace } from "./widgets/widget-mutations.js";
import * as store from "../persistence/space-store.js";

const NO_BROWSER_VIEW_USER_MSG =
  "no_browser_view: could not attach a browser view to this workspace";

/** Grid height for new lead-finder widgets only (updates keep user layout). */
export function leadFinderLayoutHeightForRowCount(count: number): number {
  if (count <= 5) return 8;
  if (count <= 10) return 12;
  if (count <= 20) return 18;
  if (count <= 40) return 26;
  return 32;
}

export function composeLeadFinderMapsQuery(query: string, location?: string): string {
  const q = query.trim();
  const loc = location?.trim();
  if (!loc) return q;
  const locLower = loc.toLowerCase();
  if (q.toLowerCase().includes(locLower)) return q;
  return `${q} in ${loc}`;
}

export function businessForLeadFinderPayload(b: PerformScrapeMapsBusinessRow): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: b.name,
    rating: b.rating,
    reviewCount: b.reviewCount,
    category: b.category,
    address: b.address,
    phone: b.phone,
    hours: b.hours,
    reviewSnippet: b.reviewSnippet,
    website: b.website,
    hasDirections: b.hasDirections,
  };
  if (b.audit) {
    row.audit = {
      url: b.audit.url,
      finalUrl: b.audit.finalUrl,
      fetched: b.audit.fetched,
      statusCode: b.audit.statusCode,
      sslValid: b.audit.sslValid,
      responseTimeMs: b.audit.responseTimeMs,
      contentBytes: b.audit.contentBytes,
      techStack: b.audit.techStack ?? [],
      signals: (b.audit.signals ?? []).map((s) => ({ id: s.id, label: s.label, weight: s.weight })),
      badnessScore: b.audit.badnessScore,
      error: b.audit.error,
    };
  }
  return row;
}

export type RunLeadFinderForSpaceParams = {
  spaceId: string;
  userId: string;
  /** String passed to Google Maps search (already composed if needed). */
  mapsQuery: string;
  widgetId?: string;
  waitMs?: number;
  scrollSteps?: number;
  scrollDelayMs?: number;
  audit?: boolean;
  maxResults?: number;
  log: Pick<FastifyBaseLogger, "info" | "warn">;
};

export type RunLeadFinderForSpaceOk = {
  ok: true;
  widgetId: string;
  businessCount: number;
  avgBadness: number | null;
  durationMs: number;
};

export type RunLeadFinderForSpaceErr = { ok: false; code: string; message: string };

/**
 * Maps scrape → lead-finder widget payload → create/update widget (includes snapshot via widget-mutations).
 * Shared by HTTP `/lead-finder/run` and chat `workflow.run`.
 */
export async function runLeadFinderForSpace(
  params: RunLeadFinderForSpaceParams,
): Promise<RunLeadFinderForSpaceOk | RunLeadFinderForSpaceErr> {
  const {
    spaceId,
    userId,
    mapsQuery,
    widgetId,
    waitMs,
    scrollSteps,
    scrollDelayMs,
    audit,
    maxResults,
    log,
  } = params;

  let scrape: Awaited<ReturnType<typeof performScrapeMaps>> | undefined;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const attached = await probeNativeBrowserViewReady(log);
      log.info({ spaceId, attached, retry: attempt > 0 }, "lead-finder.ensure-browser");
      try {
        scrape = await performScrapeMaps({
          spaceId,
          query: mapsQuery,
          waitMs,
          scrollSteps,
          scrollDelayMs,
          audit,
          maxResults,
          log,
        });
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "no_browser_view" && attempt === 0) {
          continue;
        }
        if (msg === "no_browser_view") {
          throw new Error(NO_BROWSER_VIEW_USER_MSG);
        }
        throw err instanceof Error ? err : new Error(msg);
      }
    }
    if (!scrape) {
      throw new Error(NO_BROWSER_VIEW_USER_MSG);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_url") {
      return { ok: false, code: "invalid_url", message: "Enter a valid http(s) URL." };
    }
    if (msg === NO_BROWSER_VIEW_USER_MSG || msg === "no_browser_view") {
      return { ok: false, code: "no_browser_view", message: NO_BROWSER_VIEW_USER_MSG };
    }
    return { ok: false, code: "scrape_failed", message: msg.slice(0, 400) };
  }

  const payloadRaw: Record<string, unknown> = {
    query: mapsQuery,
    locationLabel: mapsQuery,
    scrapedAt: new Date().toISOString(),
    sourceUrl: scrape.url,
    businessCount: scrape.businessCount,
    websiteFound: scrape.websiteFound,
    noWebsiteCount: scrape.noWebsiteCount,
    auditedCount: scrape.auditedCount,
    avgBadness: scrape.avgBadness,
    durationMs: scrape.durationMs,
    businesses: scrape.businesses.map(businessForLeadFinderPayload),
  };
  const dataParsed = parseWidgetPayload("lead-finder", payloadRaw) as Record<string, unknown>;

  let targetId = widgetId;
  if (targetId) {
    const existing = await store.getWidget(spaceId, targetId, userId);
    if (existing?.kind === "lead-finder") {
      const upd = await updateWidgetForSpace(
        spaceId,
        targetId,
        { data: dataParsed, title: `Leads: ${mapsQuery}` },
        userId,
      );
      if (!upd.ok) {
        return {
          ok: false,
          code: upd.code === "not_found" ? "not_found" : "invalid_body",
          message: upd.message,
        };
      }
      log.info(
        { spaceId, widgetId: targetId, businessCount: scrape.businessCount },
        "lead-finder.run complete",
      );
      return {
        ok: true,
        widgetId: targetId,
        businessCount: scrape.businessCount,
        avgBadness: scrape.avgBadness,
        durationMs: scrape.durationMs,
      };
    }
    targetId = undefined;
  }

  const baseLayout = defaultLayoutForKind("lead-finder");
  const desiredLayout = {
    x: baseLayout.x,
    y: baseLayout.y,
    w: baseLayout.w,
    h: leadFinderLayoutHeightForRowCount(scrape.businesses.length),
  };
  const existingWidgets = await store.listWidgetRecords(spaceId, userId);
  const resolvedLayout = nudgeLayoutBelowConflicts(desiredLayout, existingWidgets);
  const created = await createWidgetForSpace(
    spaceId,
    {
      kind: "lead-finder",
      title: `Leads: ${mapsQuery}`,
      data: dataParsed,
      layout: resolvedLayout,
    },
    userId,
  );
  if (!created.ok) {
    return { ok: false, code: created.code, message: created.message };
  }
  const newId = created.widget.id;
  log.info({ spaceId, widgetId: newId, businessCount: scrape.businessCount }, "lead-finder.run complete");
  return {
    ok: true,
    widgetId: newId,
    businessCount: scrape.businessCount,
    avgBadness: scrape.avgBadness,
    durationMs: scrape.durationMs,
  };
}
