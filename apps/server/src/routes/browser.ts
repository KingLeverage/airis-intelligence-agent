import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { BrowserPageTranscription } from "@airis/shared";
import * as browserSession from "../browser/session-store.js";
import { transcribeUrl } from "../browser/transcribe.js";
import { normalizeHttpUrl } from "../browser/url-utils.js";
import { buildBrowserPreviewDocument } from "../browser/preview-html.js";
import {
  isPlaywrightBrowserEnabled,
  playwrightScreenshotPng,
} from "../browser/playwright-runtime.js";
import {
  applyBrowserActionRequest,
  BrowserActionRequestSchema,
} from "../browser/space-browser-actions.js";
import { requestNativeAction } from "../browser/native-bridge.js";
import { parseGoogleMapsResults, type MapsBusiness } from "../services/maps-parser.js";
import { auditWebsitesParallel, noWebsiteAudit, type WebsiteAudit } from "../services/website-audit.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import { DEFAULT_USER_ID, isPreviewUnsafeFullPageEnabled } from "../config.js";

const TranscribeBody = z.object({
  url: z.string().min(1),
  mode: z.enum(["mock", "fetch"]).optional(),
});

const NavigateBody = z.object({
  url: z.string().min(1),
  /** `visual` = update session URL for the in-app iframe only (no server HTML fetch). */
  mode: z.enum(["mock", "fetch", "visual"]).optional(),
});

const NativeBrowserEvaluateBody = z.object({
  script: z.string().min(1).max(20_000),
  timeoutMs: z.coerce.number().int().min(1000).max(60_000).optional().default(15_000),
});

const NativeBrowserExtractBody = z.object({
  kind: z.enum(["text", "html", "both"]).optional().default("text"),
  timeoutMs: z.coerce.number().int().min(1000).max(60_000).optional().default(15_000),
});

const NativeBrowserScrapeBody = z.object({
  url: z.string().min(1),
  waitMs: z.coerce.number().int().min(0).max(30_000).optional().default(3500),
  maxChars: z.coerce.number().int().min(1000).max(500_000).optional().default(80_000),
  includeHtml: z.boolean().optional().default(false),
  timeoutMs: z.coerce.number().int().min(5000).max(90_000).optional().default(30_000),
  scrollSteps: z.coerce.number().int().min(0).max(20).optional().default(0),
  scrollDelayMs: z.coerce.number().int().min(100).max(5000).optional().default(700),
});

const ScrapeMapsBody = z.object({
  query: z.string().min(1),
  waitMs: z.coerce.number().int().min(0).max(30_000).optional().default(8000),
  scrollSteps: z.coerce.number().int().min(0).max(20).optional().default(12),
  scrollDelayMs: z.coerce.number().int().min(100).max(5000).optional().default(1800),
  audit: z.boolean().optional().default(true),
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

function nativeBridgeErrorReply(reply: FastifyReply, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "native_bridge_unavailable") {
    return reply
      .code(503)
      .send(
        apiErr(
          "native_bridge_unavailable",
          "No active native browser bridge. Open the AIRIS desktop app.",
        ),
      );
  }
  return reply.code(502).send(apiErr("native_bridge_failed", msg.slice(0, 400)));
}

/** Origin browsers use for `/api/...` so preview HTML can emit absolute links (remote `<base>` breaks root-relative `/api`). */
function previewPublicBaseFromRequest(req: FastifyRequest): string | undefined {
  const xfProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(",")[0]?.trim() || req.protocol;
  const hostRaw = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;
  if (!host || typeof host !== "string") return undefined;
  return `${proto}://${host.split(",")[0]!.trim()}`;
}

type PerformScrapeOpts = {
  normalizedUrl: string;
  waitMs: number;
  maxChars: number;
  includeHtml: boolean;
  timeoutMs: number;
  scrollSteps: number;
  scrollDelayMs: number;
  /** Google Maps: after each scroll, count `div.Nv2PK` and stop after `stallLimit` consecutive unchanged counts. */
  mapsScrollTelemetry?: {
    log: FastifyBaseLogger;
    stallLimit: number;
  };
};

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip Maps accessibility hints from DOM-harvested titles so keys match `parseGoogleMapsResults` names. */
function stripMapsHarvestNameNoise(raw: string): string {
  return raw
    .replace(/\s*[·•]\s*visited\s*link\s*$/i, "")
    .replace(/\s*visited\s*link\s*$/i, "")
    .replace(/\s*[·•]\s*sponsored\s*$/i, "")
    .replace(/\s*[·•]\s*ad\s*$/i, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

type ScrapeMapsBusinessRow = MapsBusiness & { audit?: WebsiteAudit | null };

/** One DOM-harvested listing: display name + website (keyed separately by normalized name in the Map). */
type MapsHarvestEntry = { name: string; website: string | null };

const MAPS_HARVEST_HELPERS = `
    function normTxt(s) { return (s || '').replace(/\\s+/g, ' ').trim().toLowerCase(); }
    function hasSponsoredText(card) {
      var all = card.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var t = normTxt(all[i].textContent || '');
        if (t.indexOf('sponsored') !== -1) return true;
        if (t.indexOf('ad ·') !== -1 || t.indexOf('· ad') !== -1) return true;
      }
      return false;
    }
    function hasSponsoredFontSpan(card) {
      var spans = card.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var el = spans[i];
        var cls = (el.getAttribute('class') || '');
        if (cls.indexOf('fontBodyMedium') === -1) continue;
        if (normTxt(el.textContent) === 'sponsored') return true;
      }
      return false;
    }
    function hasAclk(card) {
      var as = card.querySelectorAll('a[href]');
      for (var i = 0; i < as.length; i++) {
        var h = as[i].href || '';
        if (h.indexOf('https://www.google.com/aclk?') === 0) return true;
        if (h.indexOf('/aclk?') !== -1) return true;
      }
      return false;
    }
    function ariaSponsoredOrAd(card) {
      var all = card.querySelectorAll('[aria-label]');
      for (var i = 0; i < all.length; i++) {
        var lab = normTxt(all[i].getAttribute('aria-label') || '');
        if (lab.indexOf('sponsored') !== -1) return true;
        if (/\\bad\\b/i.test(lab)) return true;
      }
      return false;
    }
    function sponsoredHtmlNoRankSibling(card) {
      if (!/\\bSponsored\\b/i.test(card.outerHTML || '')) return false;
      var feedEl = card.closest('[role="feed"]') || card.closest('[role="main"]');
      if (!feedEl) return false;
      var list = Array.from(feedEl.querySelectorAll(':scope > div.Nv2PK'));
      var idx = list.indexOf(card);
      if (idx < 0) return true;
      function looksRanked(el) {
        var t = normTxt(el.textContent || '');
        return /^\\d+\\.\\s/.test(t);
      }
      if (idx > 0 && looksRanked(list[idx - 1])) return false;
      if (idx + 1 < list.length && looksRanked(list[idx + 1])) return false;
      return true;
    }
    function isSponsoredCard(card) {
      if (hasSponsoredText(card)) return true;
      if (hasSponsoredFontSpan(card)) return true;
      if (hasAclk(card)) return true;
      if (ariaSponsoredOrAd(card)) return true;
      if (sponsoredHtmlNoRankSibling(card)) return true;
      return false;
    }
    function scrubHarvestHref(href) {
      if (!href || typeof href !== 'string') return null;
      if (href.indexOf('/aclk?') !== -1) return null;
      if (href.indexOf('https://www.google.com/aclk?') === 0) return null;
      if (href.indexOf('http') !== 0) return null;
      return href;
    }
`.trim();

/** Full-feed one-shot harvest (same helpers as {@link MAPS_CARD_SNAPSHOT_EXPR}); exported for parity / tooling. */
export const MAPS_WEBSITE_HARVEST_SCRIPT = `
(function(){
  try {
${MAPS_HARVEST_HELPERS}
    var feed = document.querySelector('[role="feed"]') || document.querySelector('[role="main"]');
    if (!feed) return JSON.stringify({ rows: [], stats: { totalCards: 0, sponsoredDropped: 0, kept: 0 } });
    var cards = Array.from(feed.querySelectorAll('div.Nv2PK'));
    if (cards.length === 0) {
      cards = Array.from(feed.querySelectorAll('a.hfpxzc')).map(function(a){
        return a.closest('div[jsaction]') || a.parentElement;
      }).filter(Boolean);
    }
    var totalCards = cards.length;
    var seen = new Set();
    var out = [];
    var sponsoredDropped = 0;
    cards.forEach(function(card){
      if (!card || seen.has(card)) return;
      seen.add(card);
      if (isSponsoredCard(card)) { sponsoredDropped++; return; }
      var nameEl = card.querySelector('a.hfpxzc') || card.querySelector('div.qBF1Pd');
      var name = nameEl ? (nameEl.getAttribute('aria-label') || nameEl.textContent || '').trim() : '';
      if (!name) return;
      var websiteEl = card.querySelector('a[data-value="Website"]')
                   || card.querySelector('a[aria-label^="Website"]')
                   || card.querySelector('a[data-item-id="authority"]');
      var href = scrubHarvestHref(websiteEl ? websiteEl.href : null);
      out.push({ name: name, website: href });
    });
    return JSON.stringify({ rows: out, stats: { totalCards: totalCards, sponsoredDropped: sponsoredDropped, kept: out.length } });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
})();`.trim();

/** Visible-window card snapshot for incremental harvest while Maps virtualizes `div.Nv2PK`. */
const MAPS_CARD_SNAPSHOT_EXPR = `
(function(){
  try {
${MAPS_HARVEST_HELPERS}
    var feed = document.querySelector('[role="feed"]') || document.querySelector('[role="main"]');
    if (!feed) return JSON.stringify({ ok: false, error: "no feed" });
    var cards = Array.from(feed.querySelectorAll('div.Nv2PK'));
    if (cards.length === 0) {
      cards = Array.from(feed.querySelectorAll('a.hfpxzc')).map(function(a){
        return a.closest('div[jsaction]') || a.parentElement;
      }).filter(Boolean);
    }
    var totalCards = cards.length;
    var seen = new Set();
    var out = [];
    var sponsoredDropped = 0;
    cards.forEach(function(card){
      if (!card || seen.has(card)) return;
      seen.add(card);
      if (isSponsoredCard(card)) { sponsoredDropped++; return; }
      var nameEl = card.querySelector('a.hfpxzc') || card.querySelector('div.qBF1Pd');
      var name = nameEl ? (nameEl.getAttribute('aria-label') || nameEl.textContent || '').trim() : '';
      if (!name) return;
      var websiteEl = card.querySelector('a[data-value="Website"]')
                   || card.querySelector('a[aria-label^="Website"]')
                   || card.querySelector('a[data-item-id="authority"]');
      var href = scrubHarvestHref(websiteEl ? websiteEl.href : null);
      out.push({ name: name, website: href });
    });
    return JSON.stringify({ ok: true, rows: out, stats: { totalCards: totalCards, sponsoredDropped: sponsoredDropped, kept: out.length } });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
})();`.trim();

function isUsableMapsHarvestHref(href: unknown): href is string {
  return (
    typeof href === "string" &&
    href.startsWith("http") &&
    !href.includes("/aclk?") &&
    !href.startsWith("https://www.google.com/aclk?")
  );
}

/** @returns 1 if a new key was inserted or a null website was upgraded to a real URL */
function mergeMapsHarvestSnapshotRow(
  accumulator: Map<string, MapsHarvestEntry>,
  rawName: string,
  websiteHref: unknown,
): number {
  const key = normName(stripMapsHarvestNameNoise(rawName));
  if (!key) return 0;
  const displayName = stripMapsHarvestNameNoise(rawName).trim() || rawName.trim();
  const website = isUsableMapsHarvestHref(websiteHref) ? websiteHref : null;
  if (!accumulator.has(key)) {
    accumulator.set(key, { name: displayName || rawName.trim(), website });
    return 1;
  }
  const cur = accumulator.get(key)!;
  if (cur.website === null && website !== null) {
    accumulator.set(key, { name: cur.name, website });
    return 1;
  }
  return 0;
}

async function runMapsSnapshotMerge(
  accumulator: Map<string, MapsHarvestEntry>,
  stepLabel: string | number,
): Promise<void> {
  let addedThisStep = 0;
  let keptStats = 0;
  try {
    const snapRes = await requestNativeAction({
      kind: "evaluate",
      expression: MAPS_CARD_SNAPSHOT_EXPR,
      timeoutMs: 5000,
    });
    if (!isRecord(snapRes) || snapRes.ok !== true) return;
    const inner = snapRes.result;
    let parsed: unknown;
    try {
      parsed = typeof inner === "string" ? JSON.parse(inner) : inner;
    } catch {
      return;
    }
    if (!isRecord(parsed) || parsed.ok !== true || !Array.isArray(parsed.rows)) return;
    const stats = parsed.stats;
    if (isRecord(stats) && typeof stats.kept === "number") keptStats = stats.kept;
    for (const row of parsed.rows) {
      if (!isRecord(row)) continue;
      const n = typeof row.name === "string" ? row.name : "";
      const w = row.website;
      if (!n) continue;
      addedThisStep += mergeMapsHarvestSnapshotRow(accumulator, n, w);
    }
  } catch {
    /* ignore snapshot errors */
  }
  console.log(`[snap] step=${stepLabel} cards=${keptStats} added=${addedThisStep} totalAccum=${accumulator.size}`);
}

/** Normalize website URL to hostname for deduping (no scheme/path/query). */
function websiteDedupeHostKey(url: string): string | null {
  try {
    const u = new URL(url);
    let h = u.hostname.toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h.length > 0 ? h : null;
  } catch {
    return null;
  }
}

function dedupeBusinessesByWebsiteHost(
  rows: ScrapeMapsBusinessRow[],
  log: FastifyBaseLogger,
): ScrapeMapsBusinessRow[] {
  type Win = { b: ScrapeMapsBusinessRow; idx: number };
  const rc = (x: ScrapeMapsBusinessRow) => x.reviewCount ?? -1;
  const winnerByHost = new Map<string, Win>();
  rows.forEach((b, idx) => {
    if (!b.website?.startsWith("http")) return;
    const k = websiteDedupeHostKey(b.website);
    if (!k) return;
    const cur = winnerByHost.get(k);
    if (!cur) {
      winnerByHost.set(k, { b, idx });
      return;
    }
    if (rc(b) > rc(cur.b)) winnerByHost.set(k, { b, idx });
  });

  let dropCount = 0;
  const droppedNames: string[] = [];
  const emitted = new Set<string>();
  const out: ScrapeMapsBusinessRow[] = [];
  for (const b of rows) {
    if (!b.website?.startsWith("http")) {
      out.push(b);
      continue;
    }
    const k = websiteDedupeHostKey(b.website);
    if (!k) {
      out.push(b);
      continue;
    }
    const win = winnerByHost.get(k);
    if (!win || win.b !== b) {
      if (win && win.b !== b) {
        dropCount += 1;
        droppedNames.push(b.name);
      }
      continue;
    }
    if (emitted.has(k)) continue;
    emitted.add(k);
    out.push(b);
  }
  log.info({ inputCount: rows.length, kept: out.length, dropped: dropCount, droppedNames }, "maps.dedupe");
  return out;
}

export type PerformScrapeMapsBusinessRow = ScrapeMapsBusinessRow;

export async function performScrapeMaps(opts: {
  spaceId: string;
  query: string;
  waitMs?: number;
  scrollSteps?: number;
  scrollDelayMs?: number;
  audit?: boolean;
  /** When set, only the first N businesses (after ranking) are returned and counted. */
  maxResults?: number;
  log: Pick<FastifyBaseLogger, "info" | "warn">;
}): Promise<{
  url: string;
  title: string;
  durationMs: number;
  businessCount: number;
  websiteFound: number;
  noWebsiteCount: number;
  auditedCount: number;
  avgBadness: number | null;
  rawTextChars: number;
  businesses: ScrapeMapsBusinessRow[];
}> {
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(opts.query)}`;
  let normalized: string;
  try {
    normalized = normalizeHttpUrl(mapsUrl);
  } catch {
    const err = new Error("invalid_url");
    throw err;
  }
  const log = opts.log as FastifyBaseLogger;
  log.info({ spaceId: opts.spaceId, query: opts.query }, "lead-finder.run start");

  const waitMs = opts.waitMs ?? 8000;
  const scrollSteps = opts.scrollSteps ?? 12;
  const scrollDelayMs = opts.scrollDelayMs ?? 1800;
  const audit = opts.audit ?? true;
  const maxResults = opts.maxResults;

  const r = await performScrape(
    opts.spaceId,
    {
      normalizedUrl: normalized,
      waitMs,
      maxChars: 80_000,
      includeHtml: false,
      timeoutMs: 30_000,
      scrollSteps,
      scrollDelayMs,
      mapsScrollTelemetry: { log, stallLimit: 3 },
    },
    log,
  );
  const parsedFromText = parseGoogleMapsResults(r.text);
  const enrichmentByNorm = new Map<string, MapsBusiness>();
  for (const b of parsedFromText) {
    const k = normName(stripMapsHarvestNameNoise(b.name));
    if (k) enrichmentByNorm.set(k, b);
  }

  const websiteByNorm = r.mapsHarvestByNorm ?? new Map<string, MapsHarvestEntry>();
  const withWebsiteCount = [...websiteByNorm.values()].filter(
    (e) => typeof e.website === "string" && e.website.startsWith("http"),
  ).length;
  log.info(
    {
      totalCards: websiteByNorm.size,
      kept: withWebsiteCount,
      sponsoredDropped: Math.max(0, websiteByNorm.size - withWebsiteCount),
    },
    "maps.harvest sponsor-filter",
  );

  let enriched: ScrapeMapsBusinessRow[] = [];
  for (const [normKey, entry] of websiteByNorm) {
    const parsed = enrichmentByNorm.get(normKey);
    if (parsed) {
      const website =
        entry.website && entry.website.startsWith("http") ? entry.website : null;
      enriched.push({
        ...parsed,
        name: entry.name,
        website,
        hasWebsite: Boolean(website?.startsWith("http")) || parsed.hasWebsite,
      });
    } else {
      enriched.push({
        name: entry.name,
        rating: null,
        reviewCount: null,
        category: null,
        address: null,
        phone: null,
        hours: null,
        reviewSnippet: null,
        hasWebsite: Boolean(entry.website?.startsWith("http")),
        hasDirections: false,
        website: entry.website && entry.website.startsWith("http") ? entry.website : null,
      });
    }
  }

  log.info(
    {
      enrichedCount: enriched.length,
      namesWithEnrichment: enriched.filter((b) => b.rating !== null).length,
    },
    "maps.enrichment done",
  );

  enriched = dedupeBusinessesByWebsiteHost(enriched, log);

  let audits: WebsiteAudit[] = [];
  if (audit) {
    log.info(
      { urlCount: enriched.filter((b) => b.website && b.website.startsWith("http")).length },
      "scrape-maps starting audit",
    );
    const urls = enriched
      .map((b) => b.website)
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"));
    audits = await auditWebsitesParallel(urls, { timeoutMs: 12_000, concurrency: 5 });
    log.info(
      {
        auditsReturned: audits.length,
        sample: audits[0]
          ? { url: audits[0].url, score: audits[0].badnessScore, fetched: audits[0].fetched }
          : null,
      },
      "scrape-maps audits complete",
    );
    const auditByUrl = new Map(audits.map((a) => [a.url, a]));
    enriched.forEach((b) => {
      if (b.website && b.website.startsWith("http")) {
        b.audit = auditByUrl.get(b.website) ?? null;
      } else {
        b.audit = noWebsiteAudit();
      }
    });
  }

  enriched.sort((a, b) => {
    const aNo = a.website ? 0 : 1;
    const bNo = b.website ? 0 : 1;
    if (aNo !== bNo) return bNo - aNo;
    const aScore = a.audit?.badnessScore ?? -1;
    const bScore = b.audit?.badnessScore ?? -1;
    if (aScore !== bScore) return bScore - aScore;
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  });

  const capped =
    typeof maxResults === "number" && Number.isFinite(maxResults) && maxResults > 0
      ? enriched.slice(0, Math.floor(maxResults))
      : enriched;
  enriched = capped;

  const websiteFound = enriched.filter((b) => b.website != null).length;
  const noWebsiteCount = enriched.filter((b) => b.website == null).length;
  const auditedCount = audits.length;
  const validScores = enriched
    .map((b) => b.audit?.badnessScore)
    .filter((s): s is number => typeof s === "number");
  const avgBadness =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;

  return {
    url: r.url,
    title: r.title,
    durationMs: r.durationMs,
    businessCount: enriched.length,
    websiteFound,
    noWebsiteCount,
    auditedCount,
    avgBadness,
    rawTextChars: r.text.length,
    businesses: enriched,
  };
}

/** Shared native BrowserView scrape (navigate → wait → optional scroll → extract). */
async function performScrape(
  spaceId: string,
  opts: PerformScrapeOpts,
  log: FastifyBaseLogger,
): Promise<{
  title: string;
  url: string;
  text: string;
  html?: string;
  durationMs: number;
  mapsHarvestByNorm?: Map<string, MapsHarvestEntry>;
}> {
  const startTs = Date.now();
  await browserSession.getSession(spaceId, DEFAULT_USER_ID);
  const { normalizedUrl, waitMs, maxChars, includeHtml, timeoutMs, scrollSteps, scrollDelayMs } = opts;

  const navExpr = `location.href = ${JSON.stringify(normalizedUrl)}`;
  const navRes = await requestNativeAction({
    kind: "evaluate",
    expression: navExpr,
    timeoutMs,
  });
  if (!isRecord(navRes) || navRes.ok !== true) {
    const err =
      isRecord(navRes) && typeof navRes.error === "string" ? navRes.error : "navigate_failed";
    throw new Error(err);
  }
  await new Promise<void>((r) => setTimeout(r, waitMs));

  const scrollTelemetry = opts.mapsScrollTelemetry;
  const mapsHarvestByNorm = scrollTelemetry ? new Map<string, MapsHarvestEntry>() : undefined;
  let mapsRescuePerformed = false;
  let prevCardCount: number | null = null;
  let prevAccumulatorSize: number | null = null;
  let stallRounds = 0;
  let prevFeedScrollTop: number | null = null;

  const scrollMapsFeedExpr = `
(function(){
  try {
    var candidates = [
      document.querySelector('[role="feed"]'),
      document.querySelector('div[aria-label*="Results for"]'),
      document.querySelector('[role="main"] [tabindex="-1"]')
    ];
    var feed = null;
    for (var ci = 0; ci < candidates.length; ci++) {
      var el = candidates[ci];
      if (el && el.scrollHeight > el.clientHeight) {
        feed = el;
        break;
      }
    }
    var scrollTopBefore = feed ? feed.scrollTop : null;
    if (feed) {
      var delta = Math.max(800, (feed.clientHeight || 0) * 0.8);
      feed.scrollTop = (feed.scrollTop || 0) + delta;
      try {
        feed.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, bubbles: true, cancelable: true }));
      } catch (eW) {}
    }
    var scrollTopAfter = feed ? feed.scrollTop : null;
    return JSON.stringify({
      foundFeed: !!feed,
      feedTag: feed ? feed.tagName : null,
      feedRole: feed ? feed.getAttribute('role') : null,
      scrollTopBefore: scrollTopBefore,
      scrollTopAfter: scrollTopAfter,
      scrollHeight: feed ? feed.scrollHeight : null,
      clientHeight: feed ? feed.clientHeight : null
    });
  } catch (e) {
    return JSON.stringify({
      foundFeed: false,
      feedTag: null,
      feedRole: null,
      scrollTopBefore: null,
      scrollTopAfter: null,
      scrollHeight: null,
      clientHeight: null,
      error: String(e)
    });
  }
})();`.trim();

  const scrollMapsFeedDiagReadExpr = `
(function(){
  try {
    var candidates = [
      document.querySelector('[role="feed"]'),
      document.querySelector('div[aria-label*="Results for"]'),
      document.querySelector('[role="main"] [tabindex="-1"]')
    ];
    var feed = null;
    for (var ci = 0; ci < candidates.length; ci++) {
      var el = candidates[ci];
      if (el && el.scrollHeight > el.clientHeight) { feed = el; break; }
    }
    if (!feed) {
      for (var j = 0; j < candidates.length; j++) {
        if (candidates[j]) { feed = candidates[j]; break; }
      }
    }
    return JSON.stringify({
      foundFeed: !!feed,
      feedTag: feed ? feed.tagName : null,
      feedRole: feed ? feed.getAttribute('role') : null,
      scrollTop: feed ? feed.scrollTop : null,
      scrollHeight: feed ? feed.scrollHeight : null,
      clientHeight: feed ? feed.clientHeight : null
    });
  } catch (e) {
    return JSON.stringify({ foundFeed: false, error: String(e) });
  }
})();`.trim();

  function parseNativeEvaluateJson(inner: unknown): Record<string, unknown> | null {
    try {
      const p: unknown = typeof inner === "string" ? JSON.parse(inner) : inner;
      return isRecord(p) ? p : null;
    } catch {
      return null;
    }
  }

  async function runMapsFeedScrollOnce(stepIndex: number): Promise<{
    scrollFailed: boolean;
    diag: Record<string, unknown>;
    errMsg?: string;
    feedScrollTopAfter: number | null;
    scrollMethod: "scrollWheel" | "evaluate";
    isDeepScroll: boolean;
  }> {
    const isDeepScroll = stepIndex % 4 === 3;
    const deltaY = isDeepScroll ? 2400 : 800;
    const wheelSteps = isDeepScroll ? 8 : 4;
    const emptyDiag = (): Record<string, unknown> => ({
      foundFeed: false,
      feedTag: null,
      feedRole: null,
      scrollTopBefore: null,
      scrollTopAfter: null,
      scrollHeight: null,
      clientHeight: null,
    });
    let scrollMethod: "scrollWheel" | "evaluate" = "evaluate";
    let wheelOk = false;
    try {
      const wr = await requestNativeAction({
        kind: "scrollWheel",
        payload: { x: 200, y: 300, deltaY, steps: wheelSteps, stepDelayMs: 80 },
        timeoutMs: 5000,
      });
      if (isRecord(wr) && wr.ok === true) {
        wheelOk = true;
        scrollMethod = "scrollWheel";
      } else {
        log.warn({ wheelResult: wr }, "maps.scroll scrollWheel not ok, falling back to JS scroll");
      }
    } catch (e) {
      log.warn({ err: String(e) }, "maps.scroll scrollWheel failed, falling back to JS scroll");
    }

    if (!wheelOk) {
      try {
        const scrollRes = await requestNativeAction({
          kind: "evaluate",
          expression: scrollMapsFeedExpr,
          timeoutMs: 5000,
        });
        if (!isRecord(scrollRes) || scrollRes.ok !== true) {
          const errMsg =
            isRecord(scrollRes) && typeof scrollRes.error === "string" ? scrollRes.error : "evaluate_failed";
          return {
            scrollFailed: true,
            diag: { ...emptyDiag(), evaluateOk: false },
            errMsg,
            feedScrollTopAfter: null,
            scrollMethod: "evaluate",
            isDeepScroll,
          };
        }
        const p = parseNativeEvaluateJson(scrollRes.result);
        const feedTop =
          p && typeof p.scrollTopAfter === "number" && Number.isFinite(p.scrollTopAfter)
            ? p.scrollTopAfter
            : p && typeof p.scrollTop === "number" && Number.isFinite(p.scrollTop)
              ? p.scrollTop
              : null;
        return {
          scrollFailed: false,
          diag: p ?? emptyDiag(),
          feedScrollTopAfter: feedTop,
          scrollMethod: "evaluate",
          isDeepScroll,
        };
      } catch (e) {
        return {
          scrollFailed: true,
          diag: { ...emptyDiag(), threw: true },
          errMsg: String(e),
          feedScrollTopAfter: null,
          scrollMethod: "evaluate",
          isDeepScroll,
        };
      }
    }

    try {
      const diagRes = await requestNativeAction({
        kind: "evaluate",
        expression: scrollMapsFeedDiagReadExpr,
        timeoutMs: 5000,
      });
      if (!isRecord(diagRes) || diagRes.ok !== true) {
        const errMsg =
          isRecord(diagRes) && typeof diagRes.error === "string" ? diagRes.error : "evaluate_failed";
        return {
          scrollFailed: true,
          diag: { ...emptyDiag() },
          errMsg,
          feedScrollTopAfter: null,
          scrollMethod,
          isDeepScroll,
        };
      }
      const p = parseNativeEvaluateJson(diagRes.result) ?? emptyDiag();
      const top = typeof p.scrollTop === "number" && Number.isFinite(p.scrollTop) ? p.scrollTop : null;
      const diagOut: Record<string, unknown> = {
        foundFeed: p.foundFeed,
        feedTag: p.feedTag,
        feedRole: p.feedRole,
        scrollTopBefore: null,
        scrollTopAfter: top,
        scrollHeight: p.scrollHeight,
        clientHeight: p.clientHeight,
        error: p.error,
      };
      return { scrollFailed: false, diag: diagOut, feedScrollTopAfter: top, scrollMethod, isDeepScroll };
    } catch (e) {
      return {
        scrollFailed: true,
        diag: { ...emptyDiag(), threw: true },
        errMsg: String(e),
        feedScrollTopAfter: null,
        scrollMethod,
        isDeepScroll,
      };
    }
  }

  function mapsScrollDiagLogFields(
    diag: Record<string, unknown>,
    scrollTopBeforeOverride: number | null,
  ): Record<string, unknown> {
    const afterRaw = diag.scrollTopAfter ?? diag.scrollTop;
    const after =
      typeof afterRaw === "number" && Number.isFinite(afterRaw) ? afterRaw : null;
    const beforeO = diag.scrollTopBefore;
    const beforeFromDiag =
      typeof beforeO === "number" && Number.isFinite(beforeO) ? beforeO : null;
    return {
      foundFeed: diag.foundFeed,
      feedTag: diag.feedTag,
      feedRole: diag.feedRole,
      scrollTopBefore: scrollTopBeforeOverride ?? beforeFromDiag,
      scrollTopAfter: after,
      scrollHeight: diag.scrollHeight,
      clientHeight: diag.clientHeight,
      error: diag.error,
    };
  }

  async function readNv2pkCount(): Promise<number> {
    const countExpr = `JSON.stringify(document.querySelectorAll('div.Nv2PK').length)`;
    let cardCount = 0;
    try {
      const cRes = await requestNativeAction({
        kind: "evaluate",
        expression: countExpr,
        timeoutMs: 5000,
      });
      if (isRecord(cRes) && cRes.ok === true) {
        const inner = cRes.result;
        if (typeof inner === "number" && Number.isFinite(inner)) {
          cardCount = inner;
        } else {
          const raw = typeof inner === "string" ? inner.trim() : JSON.stringify(inner);
          try {
            const parsedCount: unknown = JSON.parse(raw);
            const n =
              typeof parsedCount === "number"
                ? parsedCount
                : parseInt(String(parsedCount), 10);
            if (Number.isFinite(n)) cardCount = n;
          } catch {
            const n2 = parseInt(raw, 10);
            if (Number.isFinite(n2)) cardCount = n2;
          }
        }
      }
    } catch {
      /* ignore count errors */
    }
    return cardCount;
  }

  type MapsScrollExitReason = "completed" | "stalled" | "error";
  let mapsScrollExitReason: MapsScrollExitReason = "completed";
  let mapsScrollIterationsRun = 0;

  if (scrollTelemetry) {
    scrollTelemetry.log.info(
      { scrollSteps, scrollDelayMs, stallLimit: scrollTelemetry.stallLimit },
      "maps.scroll loop begin",
    );
  }

  for (let si = 0; si < scrollSteps; si++) {
    mapsScrollIterationsRun = si + 1;
    const scrollOut = await runMapsFeedScrollOnce(si);
    const scrollFailed = scrollOut.scrollFailed;
    if (scrollFailed) {
      mapsScrollExitReason = "error";
      log.warn(
        { err: scrollOut.errMsg ?? "scroll_failed", step: si },
        "browser.scrape scroll step failed",
      );
    }

    if (scrollTelemetry && mapsHarvestByNorm && !scrollFailed) {
      await runMapsSnapshotMerge(mapsHarvestByNorm, si);
    }

    const cardCount = scrollTelemetry ? await readNv2pkCount() : 0;
    const accumulatorSize = mapsHarvestByNorm?.size ?? 0;
    if (scrollTelemetry) {
      const deltaSinceLast = prevCardCount === null ? cardCount : cardCount - prevCardCount;
      scrollTelemetry.log.info(
        {
          step: si,
          scrollMethod: scrollOut.scrollMethod,
          isDeepScroll: scrollOut.isDeepScroll,
          ...mapsScrollDiagLogFields(scrollOut.diag, prevFeedScrollTop),
          accumulatorSize,
          cardCount,
          deltaSinceLast,
          scrollFailed,
        },
        "maps.scroll diag",
      );
      if (scrollOut.feedScrollTopAfter !== null) prevFeedScrollTop = scrollOut.feedScrollTopAfter;
      prevCardCount = cardCount;
    }

    if (scrollTelemetry && mapsHarvestByNorm && !scrollFailed) {
      const sz = mapsHarvestByNorm.size;
      if (prevAccumulatorSize !== null && sz === prevAccumulatorSize) {
        stallRounds += 1;
        if (stallRounds >= scrollTelemetry.stallLimit && sz >= 12) {
          mapsScrollExitReason = "stalled";
          break;
        }
      } else {
        stallRounds = 0;
        prevAccumulatorSize = sz;
      }
    }

    if (scrollFailed) break;
    await new Promise<void>((r) => setTimeout(r, scrollDelayMs));
  }

  if (scrollTelemetry && mapsHarvestByNorm) {
    scrollTelemetry.log.info(
      { accumulatedCount: mapsHarvestByNorm.size, scrollIterations: mapsScrollIterationsRun },
      "maps.harvest accumulated",
    );
  }

  if (scrollTelemetry) {
    const finalAfterScrollLoop = await readNv2pkCount();
    scrollTelemetry.log.info(
      {
        iterationsRun: mapsScrollIterationsRun,
        finalCardCount: finalAfterScrollLoop,
        accumulatorSize: mapsHarvestByNorm?.size ?? 0,
        exitReason: mapsScrollExitReason,
      },
      "maps.scroll loop end",
    );
  }

  if (scrollTelemetry && !mapsRescuePerformed && mapsHarvestByNorm) {
    if (mapsHarvestByNorm.size < 10) {
      mapsRescuePerformed = true;
      scrollTelemetry.log.info(
        { accumulatorSize: mapsHarvestByNorm.size, rescueTriggered: true },
        "maps.scroll rescue",
      );
      for (let ri = 0; ri < 5; ri++) {
        const rescueScroll = await runMapsFeedScrollOnce(scrollSteps + ri);
        if (rescueScroll.scrollFailed) {
          log.warn(
            { err: rescueScroll.errMsg ?? "scroll_failed", step: ri, rescue: true },
            "browser.scrape rescue scroll failed",
          );
          break;
        }
        if (scrollTelemetry) {
          const cardCount = await readNv2pkCount();
          scrollTelemetry.log.info(
            {
              step: `rescue-${ri}`,
              scrollMethod: rescueScroll.scrollMethod,
              isDeepScroll: rescueScroll.isDeepScroll,
              ...mapsScrollDiagLogFields(rescueScroll.diag, prevFeedScrollTop),
              accumulatorSize: mapsHarvestByNorm.size,
              cardCount,
              deltaSinceLast: null,
              scrollFailed: false,
            },
            "maps.scroll diag",
          );
          if (rescueScroll.feedScrollTopAfter !== null) prevFeedScrollTop = rescueScroll.feedScrollTopAfter;
        }
        await runMapsSnapshotMerge(mapsHarvestByNorm, `rescue-${ri}`);
        await new Promise<void>((r) => setTimeout(r, 1200));
      }
    }
  }

  const metaExpr = `JSON.stringify({title: document.title, url: location.href})`;
  const extractTasks: Promise<unknown>[] = [
    requestNativeAction({ kind: "evaluate", expression: metaExpr, timeoutMs }),
    requestNativeAction({ kind: "extractText", timeoutMs }),
  ];
  if (includeHtml) {
    extractTasks.push(requestNativeAction({ kind: "extractHtml", timeoutMs }));
  }
  const out = await Promise.all(extractTasks);
  const evalRes = out[0];
  if (!isRecord(evalRes) || evalRes.ok !== true) {
    const err =
      isRecord(evalRes) && typeof evalRes.error === "string" ? evalRes.error : "evaluate_failed";
    throw new Error(err);
  }
  let title = "";
  let finalUrl = normalizedUrl;
  const inner = evalRes.result;
  try {
    const parsed: unknown = typeof inner === "string" ? JSON.parse(inner) : inner;
    if (isRecord(parsed)) {
      if (typeof parsed.title === "string") title = parsed.title;
      if (typeof parsed.url === "string" && parsed.url.trim()) finalUrl = parsed.url;
    }
  } catch {
    /* keep defaults */
  }
  const tr = out[1];
  if (!isRecord(tr) || tr.ok !== true) {
    const err = isRecord(tr) && typeof tr.error === "string" ? tr.error : "extractText_failed";
    throw new Error(err);
  }
  const rawText = typeof tr.text === "string" ? tr.text : "";
  if (!title && typeof tr.title === "string") title = tr.title;
  if (finalUrl === normalizedUrl && typeof tr.url === "string" && tr.url.trim()) {
    finalUrl = tr.url;
  }
  const text = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  let html: string | undefined;
  if (includeHtml) {
    const hr = out[2];
    if (!isRecord(hr) || hr.ok !== true) {
      const err = isRecord(hr) && typeof hr.error === "string" ? hr.error : "extractHtml_failed";
      throw new Error(err);
    }
    const rawHtml = typeof hr.html === "string" ? hr.html : "";
    html = rawHtml.length > maxChars ? rawHtml.slice(0, maxChars) : rawHtml;
  }
  const durationMs = Date.now() - startTs;
  return {
    title: title ?? "",
    url: finalUrl ?? normalizedUrl,
    text,
    ...(html !== undefined ? { html } : {}),
    durationMs,
    ...(mapsHarvestByNorm !== undefined ? { mapsHarvestByNorm } : {}),
  };
}

export async function registerBrowserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/browser/capabilities", async (_req, reply) => {
    return reply.send(
      apiOk({
        playwrightEnabled: isPlaywrightBrowserEnabled(),
        previewUnsafeFullPage: isPreviewUnsafeFullPageEnabled(),
      }),
    );
  });

  /**
   * Same-origin HTML preview for the in-app browser iframe. Fetches the target URL on the server,
   * strips active content, and rewrites with &lt;base&gt; so relative assets resolve. Avoids
   * cross-origin iframe blocks (x.com etc.) when the remote server allows our fetch.
   */
  app.get("/api/spaces/:spaceId/browser/preview", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const rawQ = (req.query as Record<string, unknown>).url;
    const decoded = typeof rawQ === "string" ? rawQ.trim() : "";
    if (!decoded) return reply.code(400).send(apiErr("missing_url", "Missing url query parameter."));
    let normalized: string;
    try {
      normalized = normalizeHttpUrl(decoded);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Invalid URL."));
    }
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const doc = await buildBrowserPreviewDocument(spaceId, normalized, {
      previewPublicBase: previewPublicBaseFromRequest(req),
    });
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "private, max-age=15");
    return reply.send(doc);
  });

  /** PNG snapshot of the Playwright page for this space (Space Agent–style live view). 404 if Playwright off or no session. */
  app.get("/api/spaces/:spaceId/browser/live-view.png", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const buf = await playwrightScreenshotPng(spaceId);
    if (!buf) {
      return reply.code(404).send(apiErr("no_live_view", "No Playwright page for this workspace yet."));
    }
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "private, no-store");
    return reply.send(buf);
  });

  app.post("/api/browser/transcribe", async (req, reply) => {
    const body = TranscribeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const mode =
      body.data.mode ?? (body.data.url.startsWith("http") ? ("fetch" as const) : ("mock" as const));
    const t = await transcribeUrl(body.data.url, mode);
    return reply.send(apiOk({ transcription: t }));
  });

  app.get("/api/spaces/:spaceId/browser", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const s = await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ session: s }));
  });

  app.get("/api/spaces/:spaceId/browser/session", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const s = await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ session: s }));
  });

  app.post("/api/spaces/:spaceId/browser/navigate", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = NavigateBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));

    let normalized: string;
    try {
      normalized = normalizeHttpUrl(body.data.url);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
    }

    const mode =
      body.data.mode ??
      (normalized.startsWith("http") ? ("fetch" as const) : ("mock" as const));

    if (mode === "visual") {
      const capturedAt = new Date().toISOString();
      const t: BrowserPageTranscription = {
        url: normalized,
        title: normalized,
        visibleTextSummary:
          "Visual browsing: the page is rendered in the embedded frame. Open “Agent page summary” below to fetch a text snapshot for the agent.",
        interactiveElements: [],
        forms: [],
        scrollPosition: 0,
        capturedAt,
      };
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(
        apiOk({
          session,
          transcription: t,
          result: { implemented: true, message: "navigated_visual" },
        }),
      );
    }

    try {
      const t = await transcribeUrl(normalized, mode);
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(
        apiOk({
          session,
          transcription: t,
          result: { implemented: true, message: "navigated" },
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(apiErr("transcribe_failed", msg.slice(0, 400)));
    }
  });

  app.post("/api/spaces/:spaceId/browser/action", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = BrowserActionRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const { session, result } = await applyBrowserActionRequest(spaceId, body.data, DEFAULT_USER_ID);
    return reply.send(apiOk({ session, result }));
  });

  app.post("/api/spaces/:spaceId/browser/transcribe", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = TranscribeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));

    let normalized: string;
    try {
      normalized = normalizeHttpUrl(body.data.url);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
    }

    const mode =
      body.data.mode ?? (normalized.startsWith("http") ? ("fetch" as const) : ("mock" as const));
    try {
      const t = await transcribeUrl(normalized, mode);
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(apiOk({ transcription: t, session }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(apiErr("transcribe_failed", msg.slice(0, 400)));
    }
  });

  app.post("/api/spaces/:spaceId/browser/evaluate", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const body = NativeBrowserEvaluateBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    try {
      const result = await requestNativeAction({
        kind: "evaluate",
        expression: body.data.script,
        timeoutMs: body.data.timeoutMs,
      });
      return reply.send(apiOk({ result }));
    } catch (e) {
      return nativeBridgeErrorReply(reply, e);
    }
  });

  app.post("/api/spaces/:spaceId/browser/extract", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const body = NativeBrowserExtractBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const timeoutMs = body.data.timeoutMs;
    const kind = body.data.kind;
    try {
      const metaExpr = `JSON.stringify({title: document.title, url: location.href})`;
      const tasks: Promise<unknown>[] = [
        requestNativeAction({ kind: "evaluate", expression: metaExpr, timeoutMs }),
      ];
      if (kind === "text" || kind === "both") {
        tasks.push(requestNativeAction({ kind: "extractText", timeoutMs }));
      }
      if (kind === "html" || kind === "both") {
        tasks.push(requestNativeAction({ kind: "extractHtml", timeoutMs }));
      }
      const out = await Promise.all(tasks);
      const evalRes = out[0];
      if (!isRecord(evalRes) || evalRes.ok !== true) {
        const err =
          isRecord(evalRes) && typeof evalRes.error === "string" ? evalRes.error : "evaluate_failed";
        return reply.code(502).send(apiErr("native_bridge_failed", err.slice(0, 400)));
      }
      let title = "";
      let url = "";
      const inner = evalRes.result;
      try {
        const parsed: unknown =
          typeof inner === "string" ? JSON.parse(inner) : inner;
        if (isRecord(parsed)) {
          if (typeof parsed.title === "string") title = parsed.title;
          if (typeof parsed.url === "string") url = parsed.url;
        }
      } catch {
        return reply.code(502).send(apiErr("native_bridge_failed", "Could not parse title/url from page."));
      }
      let text: string | undefined;
      let html: string | undefined;
      let idx = 1;
      if (kind === "text" || kind === "both") {
        const tr = out[idx++];
        if (!isRecord(tr) || tr.ok !== true) {
          const err = isRecord(tr) && typeof tr.error === "string" ? tr.error : "extractText_failed";
          return reply.code(502).send(apiErr("native_bridge_failed", err.slice(0, 400)));
        }
        text = typeof tr.text === "string" ? tr.text : "";
      }
      if (kind === "html" || kind === "both") {
        const hr = out[idx++];
        if (!isRecord(hr) || hr.ok !== true) {
          const err = isRecord(hr) && typeof hr.error === "string" ? hr.error : "extractHtml_failed";
          return reply.code(502).send(apiErr("native_bridge_failed", err.slice(0, 400)));
        }
        html = typeof hr.html === "string" ? hr.html : "";
      }
      return reply.send(
        apiOk({
          title,
          url,
          ...(text !== undefined ? { text } : {}),
          ...(html !== undefined ? { html } : {}),
        }),
      );
    } catch (e) {
      return nativeBridgeErrorReply(reply, e);
    }
  });

  app.post("/api/spaces/:spaceId/browser/scrape", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = NativeBrowserScrapeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    let normalized: string;
    try {
      normalized = normalizeHttpUrl(body.data.url.trim());
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
    }
    req.log.info({ spaceId, url: normalized, waitMs: body.data.waitMs }, "browser.scrape start");
    try {
      const r = await performScrape(
        spaceId,
        {
          normalizedUrl: normalized,
          waitMs: body.data.waitMs,
          maxChars: body.data.maxChars,
          includeHtml: body.data.includeHtml,
          timeoutMs: body.data.timeoutMs,
          scrollSteps: body.data.scrollSteps,
          scrollDelayMs: body.data.scrollDelayMs,
        },
        req.log,
      );
      req.log.info(
        { durationMs: r.durationMs, textChars: r.text.length, scrollSteps: body.data.scrollSteps },
        "browser.scrape ok",
      );
      return reply.send(
        apiOk({
          url: r.url,
          title: r.title,
          text: r.text,
          ...(r.html !== undefined ? { html: r.html } : {}),
          scrapedAt: new Date().toISOString(),
          durationMs: r.durationMs,
        }),
      );
    } catch (e) {
      req.log.error({ err: e }, "browser.scrape failed");
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(apiErr("scrape_failed", msg.slice(0, 400)));
    }
  });

  app.post("/api/spaces/:spaceId/browser/scrape-maps", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = ScrapeMapsBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    req.log.info(
      { auditFlag: body.data.audit, hasAuditKey: "audit" in (req.body as object) },
      "scrape-maps audit flag check",
    );
    req.log.info({ spaceId, query: body.data.query }, "browser.scrape-maps start");
    try {
      const result = await performScrapeMaps({
        spaceId,
        query: body.data.query,
        waitMs: body.data.waitMs,
        scrollSteps: body.data.scrollSteps,
        scrollDelayMs: body.data.scrollDelayMs,
        audit: body.data.audit,
        log: req.log,
      });
      req.log.info(
        {
          websiteFound: result.websiteFound,
          noWebsiteCount: result.noWebsiteCount,
          auditedCount: result.auditedCount,
          businessCount: result.businessCount,
        },
        "browser.scrape-maps ok",
      );
      return reply.send(
        apiOk({
          query: body.data.query,
          url: result.url,
          title: result.title,
          durationMs: result.durationMs,
          businessCount: result.businessCount,
          businesses: result.businesses,
          rawTextChars: result.rawTextChars,
          websiteFound: result.websiteFound,
          noWebsiteCount: result.noWebsiteCount,
          auditedCount: result.auditedCount,
          avgBadness: result.avgBadness,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "invalid_url") {
        return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
      }
      req.log.error({ err: e }, "browser.scrape-maps failed");
      return reply.code(502).send(apiErr("scrape_failed", msg.slice(0, 400)));
    }
  });
}
