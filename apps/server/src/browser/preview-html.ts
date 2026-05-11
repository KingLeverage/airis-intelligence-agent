import * as cheerio from "cheerio";
import { isPreviewUnsafeFullPageEnabled } from "../config.js";
import { isTranscribeUrlBlocked } from "./transcribe.js";

const MAX_HTML_BYTES = 3_500_000;

/** Browser-like headers improve acceptance for public HTML endpoints (e.g. DuckDuckGo). */
const PREVIEW_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MIN_STRIPPED_BODY_CHARS = 140;

function looksLikeGoogleSearchHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.includes("googleusercontent")) return false;
  return h === "google.com" || h.endsWith(".google.com") || /\.google\.[a-z.]{2,}$/i.test(h);
}

function looksLikeBingSearchHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "bing.com" || h.endsWith(".bing.com");
}

function looksLikeDuckduckgoHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "duckduckgo.com" || h.endsWith(".duckduckgo.com");
}

function looksLikeYelpHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "yelp.com" || h.endsWith(".yelp.com");
}

/**
 * Google/Bing SERPs and DuckDuckGo's SPA shell are effectively empty once <script> is stripped.
 * Use DuckDuckGo's classic HTML endpoint for readable in-app preview without Playwright.
 */
export function resolvePreviewFetchTarget(targetUrl: string): { fetchUrl: string; bannerNote?: string } {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname.toLowerCase();
    /**
     * Raw maps hosts are almost entirely JavaScript; server preview after script-stripping is a black box.
     * Fall through to the Google *.google.com handling below (DuckDuckGo HTML mirror + banner).
     */

    if (looksLikeDuckduckgoHost(host)) {
      const q =
        u.searchParams.get("q")?.trim() ||
        u.searchParams.get("query")?.trim() ||
        u.searchParams.get("p")?.trim();
      if (q && q.length <= 800) {
        return {
          fetchUrl: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
          bannerNote:
            "duckduckgo.com is mostly JavaScript in this preview. Showing DuckDuckGo classic HTML results for your query.",
        };
      }
      return {
        fetchUrl: "https://html.duckduckgo.com/html/",
        bannerNote:
          "DuckDuckGo's homepage is mostly JavaScript in this preview. Showing the classic HTML search page instead.",
      };
    }

    if (looksLikeYelpHost(host)) {
      if (u.pathname.startsWith("/search")) {
        const desc = u.searchParams.get("find_desc")?.trim() ?? "";
        const loc = u.searchParams.get("find_loc")?.trim() ?? "";
        const parts = [desc, loc].filter(Boolean);
        if (parts.length > 0) {
          const yelpQ = parts.join(" ");
          if (yelpQ.length <= 800) {
            return {
              fetchUrl: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(yelpQ)}`,
              bannerNote:
                "Yelp usually blocks server previews (HTTP 403). Showing DuckDuckGo HTML for the same terms. Use ↗ for Yelp in your desktop browser, or set AIRIS_PLAYWRIGHT=1 for real Chromium automation.",
            };
          }
        }
      }
      return {
        fetchUrl: "https://html.duckduckgo.com/html/?q=yelp",
        bannerNote:
          "Yelp blocks server-side fetch for this page (HTTP 403). Showing DuckDuckGo HTML instead. Use ↗ for the live Yelp site, or set AIRIS_PLAYWRIGHT=1 for headless Chromium.",
      };
    }

    if (looksLikeGoogleSearchHost(host)) {
      const gq =
        u.searchParams.get("q")?.trim() ||
        u.searchParams.get("query")?.trim() ||
        u.searchParams.get("p")?.trim();
      if (u.pathname.startsWith("/search") && gq && gq.length <= 800) {
        return {
          fetchUrl: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(gq)}`,
          bannerNote:
            "Google's results need JavaScript to render in this preview. Showing DuckDuckGo HTML results for the same search instead. Use ↗ for the full Google page in your desktop browser.",
        };
      }
      const onMaps =
        host.startsWith("maps.") ||
        u.pathname === "/maps" ||
        u.pathname.startsWith("/maps/");
      if (onMaps) {
        const place =
          gq ||
          decodeURIComponent(
            u.pathname
              .replace(/^\/maps\/(?:search|place)\//i, "")
              .replace(/\+/g, " ")
              .split("/")[0] ?? "",
          ).trim();
        const ddgQ =
          place && place.length <= 800
            ? `${place} map`
            : "openstreetmap";
        return {
          fetchUrl: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgQ)}`,
          bannerNote:
            "Google Maps is almost entirely JavaScript and cannot render in the server preview. Showing DuckDuckGo HTML for a related search; use the Chromium snapshot, ↗ for Maps in your browser, or agent browser.click for automation.",
        };
      }
      return {
        fetchUrl: "https://html.duckduckgo.com/html/",
        bannerNote:
          "Google’s homepage and many paths need JavaScript in a real browser. Showing DuckDuckGo’s classic HTML search page instead. Use ↗ for google.com in your desktop tab.",
      };
    }

    if (looksLikeBingSearchHost(host)) {
      const bq =
        u.searchParams.get("q")?.trim() ||
        u.searchParams.get("query")?.trim() ||
        u.searchParams.get("p")?.trim();
      if (u.pathname.includes("search") && bq && bq.length <= 800) {
        return {
          fetchUrl: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(bq)}`,
          bannerNote:
            "Bing's HTML is mostly script-driven here. Showing DuckDuckGo HTML results for the same search instead. Use ↗ for the full Bing page in your desktop browser.",
        };
      }
      return {
        fetchUrl: "https://html.duckduckgo.com/html/",
        bannerNote:
          "Bing pages are often script-heavy in this preview. Showing DuckDuckGo’s classic HTML search page instead. Use ↗ for bing.com in your desktop tab.",
      };
    }

    const q =
      u.searchParams.get("q")?.trim() ||
      u.searchParams.get("query")?.trim() ||
      u.searchParams.get("p")?.trim();
    if (!q || q.length > 800) return { fetchUrl: targetUrl };
  } catch {
    /* ignore */
  }
  return { fetchUrl: targetUrl };
}

export function tryExtractSearchQueryFromUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const q =
      u.searchParams.get("q")?.trim() ||
      u.searchParams.get("query")?.trim() ||
      u.searchParams.get("p")?.trim();
    if (!q || q.length > 800) return null;
    return q;
  } catch {
    return null;
  }
}

/**
 * Search-shaped URLs for preview fallbacks: generic `q=` plus Yelp `find_desc` + `find_loc`.
 * Used when the origin returns 401/403/429 to server-side fetch.
 */
export function tryExtractFallbackSearchQuery(urlStr: string): string | null {
  const generic = tryExtractSearchQueryFromUrl(urlStr);
  if (generic) return generic;
  try {
    const u = new URL(urlStr);
    if (looksLikeYelpHost(u.hostname)) {
      if (u.pathname.startsWith("/search")) {
        const desc = u.searchParams.get("find_desc")?.trim() ?? "";
        const loc = u.searchParams.get("find_loc")?.trim() ?? "";
        const parts = [desc, loc].filter(Boolean);
        if (parts.length === 0) return "yelp";
        const q = parts.join(" ");
        return q.length <= 800 ? q : null;
      }
      return "yelp";
    }
  } catch {
    /* ignore */
  }
  return null;
}

function strippedBodyVisibleLen(html: string): number {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().length;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPreviewErrorPage(targetUrl: string, message: string, openUrl?: string): string {
  const open = openUrl ?? targetUrl;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Preview</title></head><body style="margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:1.5rem;line-height:1.5"><h1 style="font-size:1rem;font-weight:600">Could not show a preview</h1><p style="opacity:.85;font-size:.9rem">${escapeHtml(message)}</p><p><a href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer" style="color:#5eead4">Open this URL in a new tab</a></p></body></html>`;
}

function previewReloadHref(
  spaceId: string | undefined,
  linkOriginalUrl: string | undefined,
  fallback: string,
  previewPublicBase?: string,
): string {
  if (spaceId && linkOriginalUrl) {
    const path = `/api/spaces/${spaceId}/browser/preview?url=${encodeURIComponent(linkOriginalUrl)}`;
    const b = previewPublicBase?.replace(/\/$/, "");
    return b ? `${b}${path}` : path;
  }
  return fallback;
}

/** Keep clicks inside the AIRIS preview iframe (avoid navigating to DDG / Yelp in-frame, which triggers X-Frame / connection errors). */
function rewriteAnchorsToPreviewProxy(
  $: cheerio.CheerioAPI,
  spaceId: string,
  resolveRelativeAgainst: string,
  previewPublicBase?: string,
): void {
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href")?.trim();
    if (
      !raw ||
      raw.startsWith("#") ||
      raw.startsWith("/api/spaces/") ||
      raw.toLowerCase().startsWith("javascript:") ||
      raw.toLowerCase().startsWith("mailto:") ||
      raw.toLowerCase().startsWith("tel:")
    ) {
      return;
    }
    let abs: string;
    try {
      abs = new URL(raw, resolveRelativeAgainst).href;
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(abs)) return;
    const path = `/api/spaces/${spaceId}/browser/preview?url=${encodeURIComponent(abs)}`;
    const b = previewPublicBase?.replace(/\/$/, "");
    $(el).attr("href", b ? `${b}${path}` : path);
    $(el).attr("target", "_self");
  });
}

function stripDangerousAttrs($: cheerio.CheerioAPI): void {
  $("*").each((_, el) => {
    const node = el as { type?: string; attribs?: Record<string, string> };
    if (node.type !== "tag" || !node.attribs) return;
    const $el = $(el);
    for (const name of Object.keys(node.attribs)) {
      if (/^on/i.test(name)) {
        $el.removeAttr(name);
        continue;
      }
      const v = node.attribs[name];
      if (typeof v === "string" && /^\s*javascript:/i.test(v)) {
        $el.removeAttr(name);
      }
    }
  });
}

export type SanitizePreviewOpts = {
  bannerNote?: string;
  /** Required for in-frame link proxy + safe reload (original URL bar value). */
  spaceId?: string;
  linkOriginalUrl?: string;
  /**
   * Web app origin (e.g. `https://localhost:5173`). Injected into preview links so they stay on
   * AIRIS: the page sets `&lt;base href&gt;` to the remote site, which otherwise resolves
   * root-relative `/api/...` to the **remote** host (404).
   */
  previewPublicBase?: string;
  /** `AIRIS_PREVIEW_UNSAFE_FULL_PAGE=1` — keep remote scripts/DOM (dangerous; same-origin as app). */
  unsafeFullPagePreview?: boolean;
};

export type BuildBrowserPreviewDocumentOptions = {
  previewPublicBase?: string;
};

export function sanitizeFetchedHtmlForPreview(
  pageUrl: string,
  html: string,
  opts?: SanitizePreviewOpts,
): string {
  const $ = cheerio.load(html);
  const unsafe = Boolean(opts?.unsafeFullPagePreview);

  if (!unsafe) {
    /** Prefer a wide layout so server-fetched pages don’t lock to a phone-sized viewport. */
    $("meta[name]").each((_, el) => {
      const n = ($(el).attr("name") ?? "").trim().toLowerCase();
      if (n === "viewport") $(el).remove();
    });

    $("script, iframe, object, embed, template").remove();
    $("link[rel='import'], link[as='script']").remove();
    $("meta[http-equiv]").each((_, el) => {
      const h = ($(el).attr("http-equiv") ?? "").trim().toLowerCase();
      if (h === "refresh" || h === "content-security-policy") {
        $(el).remove();
      }
    });

    stripDangerousAttrs($);
  }

  let baseHref: string;
  try {
    baseHref = new URL(".", pageUrl).href;
  } catch {
    baseHref = pageUrl;
  }

  if ($("head").length === 0) {
    $("html").prepend("<head></head>");
  }
  if ($("head base").length === 0) {
    $("head").prepend(`<base href="${escapeHtml(baseHref)}" target="_self"/>`);
  }
  $("head base").first().attr("target", "_self");
  if (opts?.spaceId) {
    rewriteAnchorsToPreviewProxy($, opts.spaceId, pageUrl, opts.previewPublicBase);
  }
  $("a[target]").each((_, el) => {
    const t = ($(el).attr("target") ?? "").trim().toLowerCase();
    if (t === "_blank" || t === "_top" || t === "_parent") {
      $(el).attr("target", "_self");
    }
  });
  $("form[target]").each((_, el) => {
    const t = ($(el).attr("target") ?? "").trim().toLowerCase();
    if (t === "_blank" || t === "_top" || t === "_parent") {
      $(el).attr("target", "_self");
    }
  });

  if (!unsafe) {
    $("head").prepend(
      '<meta name="viewport" content="width=1280, initial-scale=1, minimum-scale=0.25, maximum-scale=5" />',
    );
    $("head").append(
      `<style type="text/css" data-airis-preview="1">html{-webkit-text-size-adjust:100%;}</style>`,
    );
  } else {
    $("head").append(
      `<style type="text/css" data-airis-preview="1">#airis-preview-banner{font:12px/1.4 system-ui,sans-serif}</style>`,
    );
  }

  const note = opts?.bannerNote
    ? `<span style="display:block;margin-top:.35rem;color:#cbd5e1;font-size:11px;line-height:1.45">${escapeHtml(opts.bannerNote)}</span>`
    : "";
  const reloadHref = escapeHtml(
    previewReloadHref(opts?.spaceId, opts?.linkOriginalUrl, pageUrl, opts?.previewPublicBase),
  );
  const bannerMain = unsafe
    ? `<strong style="color:#fda4af">Unsafe full preview</strong> — remote scripts run as your AIRIS origin. Solo/trusted machine only. <a href="${reloadHref}" target="_self" rel="noopener noreferrer" style="color:#5eead4">Reload</a> · <strong style="color:#e2e8f0">↗</strong> opens a normal tab.`
    : `AIRIS server preview (scripts removed). Sites that need JavaScript may look incomplete — use <strong style="color:#e2e8f0">↗</strong> in the AIRIS browser bar for the full live page. <a href="${reloadHref}" target="_self" rel="noopener noreferrer" style="color:#5eead4">Reload preview</a>`;
  const banner = `<div id="airis-preview-banner" style="position:sticky;top:0;z-index:2147483647;padding:.4rem .75rem;font:12px/1.4 system-ui,sans-serif;background:#0b1220;border-bottom:1px solid #1e293b;color:#94a3b8">${bannerMain}${note}</div>`;

  if ($("body").length === 0) {
    $("html").append(`<body>${banner}</body>`);
  } else {
    $("body").prepend(banner);
  }

  const out = $.root().html() ?? "";
  const withDoctype = out.trimStart().startsWith("<!") ? out : `<!DOCTYPE html>${out}`;
  return withDoctype;
}

function sanitizeOpts(
  spaceId: string,
  linkOriginalUrl: string,
  bannerNote?: string,
  previewPublicBase?: string,
  unsafeFullPagePreview?: boolean,
): SanitizePreviewOpts {
  return { spaceId, linkOriginalUrl, bannerNote, previewPublicBase, unsafeFullPagePreview };
}

export async function buildBrowserPreviewDocument(
  spaceId: string,
  targetUrl: string,
  buildOpts?: BuildBrowserPreviewDocumentOptions,
): Promise<string> {
  const previewPublicBase = buildOpts?.previewPublicBase;
  const unsafeFull = isPreviewUnsafeFullPageEnabled();
  if (isTranscribeUrlBlocked(targetUrl)) {
    return renderPreviewErrorPage(
      targetUrl,
      "This URL is blocked for server-side fetch (private/local addresses).",
      targetUrl,
    );
  }

  /**
   * Safe preview mirrors (Google/Bing/DDG/Yelp → classic HTML) exist because stripped-script pages
   * were empty. With `AIRIS_PREVIEW_UNSAFE_FULL_PAGE=1` we keep scripts — fetch the **exact** URL
   * the user asked for so google.com is Google, not DuckDuckGo.
   */
  const { fetchUrl, bannerNote: initialBannerNote } = unsafeFull
    ? { fetchUrl: targetUrl, bannerNote: undefined as string | undefined }
    : resolvePreviewFetchTarget(targetUrl);
  let bannerNote = initialBannerNote;

  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      headers: PREVIEW_FETCH_HEADERS,
      redirect: "follow",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return renderPreviewErrorPage(targetUrl, msg, targetUrl);
  }

  let finalUrl = res.url || fetchUrl;
  const html = await res.text();

  if (!res.ok) {
    const retryStatuses = new Set([401, 403, 429]);
    if (retryStatuses.has(res.status)) {
      const fbq = tryExtractFallbackSearchQuery(targetUrl);
      if (fbq) {
        const alt = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fbq)}`;
        if (!isTranscribeUrlBlocked(alt) && alt !== fetchUrl) {
          try {
            const res2 = await fetch(alt, {
              headers: PREVIEW_FETCH_HEADERS,
              redirect: "follow",
            });
            const html2 = await res2.text();
            if (
              res2.ok &&
              html2.length <= MAX_HTML_BYTES &&
              strippedBodyVisibleLen(html2) >= MIN_STRIPPED_BODY_CHARS
            ) {
              return sanitizeFetchedHtmlForPreview(
                res2.url || alt,
                html2,
                sanitizeOpts(
                  spaceId,
                  targetUrl,
                  `The site returned HTTP ${res.status} (often anti-bot). Showing DuckDuckGo HTML for an extracted search instead. Use ↗ or Playwright for the original URL.`,
                  previewPublicBase,
                  unsafeFull,
                ),
              );
            }
          } catch {
            /* fall through to error page */
          }
        }
      }
    }
    return renderPreviewErrorPage(
      targetUrl,
      `The site returned HTTP ${res.status} ${res.statusText || ""}`.trim(),
      finalUrl,
    );
  }

  if (html.length > MAX_HTML_BYTES) {
    return renderPreviewErrorPage(targetUrl, "Page HTML exceeds the preview size limit.", finalUrl);
  }

  let outHtml = html;
  if (
    !unsafeFull &&
    !bannerNote &&
    outHtml.length > 0 &&
    strippedBodyVisibleLen(outHtml) < MIN_STRIPPED_BODY_CHARS
  ) {
    const q = tryExtractSearchQueryFromUrl(targetUrl);
    const alt = q ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` : null;
    if (alt && !isTranscribeUrlBlocked(alt) && alt !== fetchUrl) {
      try {
        const res2 = await fetch(alt, { headers: PREVIEW_FETCH_HEADERS, redirect: "follow" });
        const html2 = await res2.text();
        if (res2.ok && html2.length <= MAX_HTML_BYTES && strippedBodyVisibleLen(html2) > strippedBodyVisibleLen(outHtml)) {
          outHtml = html2;
          finalUrl = res2.url || alt;
          bannerNote =
            "This URL returned almost no readable static HTML (common for JavaScript-heavy pages). Showing DuckDuckGo HTML search for the extracted query instead.";
        }
      } catch {
        /* keep first response */
      }
    }
  }

  if (outHtml.length > MAX_HTML_BYTES) {
    return renderPreviewErrorPage(targetUrl, "Page HTML exceeds the preview size limit.", finalUrl);
  }

  return sanitizeFetchedHtmlForPreview(
    finalUrl,
    outHtml,
    sanitizeOpts(spaceId, targetUrl, bannerNote, previewPublicBase, unsafeFull),
  );
}
