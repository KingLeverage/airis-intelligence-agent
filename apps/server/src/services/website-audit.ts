export type WebsiteSignal = {
  id: string;
  label: string;
  weight: number;
  detail: string;
};

export type WebsiteAudit = {
  url: string;
  finalUrl: string | null;
  fetched: boolean;
  statusCode: number | null;
  sslValid: boolean | null;
  responseTimeMs: number | null;
  contentBytes: number | null;
  badnessScore: number;
  signals: WebsiteSignal[];
  techStack: string[];
  error: string | null;
};

export function noWebsiteAudit(): WebsiteAudit {
  return {
    url: "",
    finalUrl: null,
    fetched: false,
    statusCode: null,
    sslValid: null,
    responseTimeMs: null,
    contentBytes: null,
    badnessScore: 95,
    signals: [
      {
        id: "no_website",
        label: "No website at all — highest-value lead",
        weight: 95,
        detail: "Business has no website listed on Google Maps.",
      },
    ],
    techStack: [],
    error: null,
  };
}

export type AuditWebsitesParallelOpts = {
  timeoutMs: number;
  concurrency: number;
};

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

async function auditOneUrl(url: string, timeoutMs: number): Promise<WebsiteAudit> {
  const rawUrl = url;
  const base: Omit<WebsiteAudit, "signals" | "badnessScore" | "fetched" | "error"> = {
    url,
    finalUrl: null,
    statusCode: null,
    sslValid: url.startsWith("https:") ? true : null,
    responseTimeMs: null,
    contentBytes: null,
    techStack: [],
  };
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": CHROME_UA },
    });
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    const finalUrl = res.url || null;
    const html = await res.text();
    const contentBytes = Buffer.byteLength(html, "utf8");
    console.log(
      "[audit]",
      rawUrl,
      "html length:",
      html.length,
      "first 200 chars:",
      html.slice(0, 200).replace(/\s+/g, " "),
    );

    const signals: WebsiteSignal[] = [];
    const techStack: string[] = [];
    const push = (id: string, label: string, weight: number, detail: string): void => {
      signals.push({ id, label, weight, detail });
    };

    if (!res.ok) {
      const w = res.status >= 500 ? 45 : 35;
      push("http_status", "HTTP error response", w, `Status ${res.status}`);
    }
    if (responseTimeMs > 4000) {
      push("slow_response", "Slow response", 18, `Took ${responseTimeMs}ms`);
    } else if (responseTimeMs > 2000) {
      push("moderate_latency", "Moderate latency", 8, `Took ${responseTimeMs}ms`);
    }

    const htmlLower = html.toLowerCase();
    const wafMarkers = [
      "request rejected",
      "access denied",
      "are you a human",
      "checking your browser",
      "cf-ray",
      "cloudflare",
      "incapsula",
      "akamai reference",
    ];
    const wafBlocked =
      html.length < 1500 && wafMarkers.some((m) => htmlLower.includes(m));
    if (wafBlocked) {
      push(
        "waf_blocked",
        "WAF/bot challenge — real site not analyzed",
        5,
        "Short body with challenge markers",
      );
    }

    if (!wafBlocked) {
      const strippedForTiny = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (strippedForTiny.length < 800) {
        push(
          "tiny_page",
          "Very little visible text after stripping markup",
          12,
          `${strippedForTiny.length} chars (threshold 800)`,
        );
      }

      const hasViewportMeta =
        htmlLower.includes('name="viewport"') ||
        htmlLower.includes("name='viewport'") ||
        /name\s*=\s*["']?viewport/i.test(html);
      if (!hasViewportMeta) {
        push("no_mobile_viewport", "Not mobile responsive", 25, "No viewport meta tag detected");
      }

      if (htmlLower.includes("wp-content") || htmlLower.includes("wp-includes")) {
        techStack.push("WordPress");
      }
      if (htmlLower.includes("wix.com") || htmlLower.includes("static.wixstatic.com")) {
        techStack.push("Wix");
      }
      if (htmlLower.includes("squarespace-cdn") || htmlLower.includes("static1.squarespace.com")) {
        techStack.push("Squarespace");
      }
      if (htmlLower.includes("weebly.com") || htmlLower.includes("editmysite.com")) {
        techStack.push("Weebly");
      }
      if (htmlLower.includes("img1.wsimg.com") || htmlLower.includes("websitebuilder.godaddy")) {
        techStack.push("GoDaddy Website Builder");
      }
      if (htmlLower.includes("cdn.shopify.com")) {
        techStack.push("Shopify");
      }
      if (htmlLower.includes("webflow.com")) {
        techStack.push("Webflow");
      }

      if (!/rel=["']?(?:shortcut )?icon/i.test(html)) {
        push("no_favicon_link", "No link rel icon in HTML", 12, "No rel=icon or rel=shortcut icon");
      }
      if (!/property=["']?og:/i.test(html)) {
        push("no_og_tags", "Missing Open Graph meta tags", 10, "No property=og:* meta found");
      }

      const tableScanHtml = html.length > 400_000 ? html.slice(0, 400_000) : html;
      if (
        /<table[\s>][^>]*>[\s\S]{200,8000}?<table/i.test(tableScanHtml) &&
        !htmlLower.includes("display:grid") &&
        !htmlLower.includes("display:flex")
      ) {
        push("table_layout", "1990s table-based layout", 15, "Nested tables without flex/grid layout");
      }

      if (htmlLower.includes("<font ")) {
        push("font_tag", "Deprecated <font> tag", 10, "Legacy font tags present");
      }

      const bgcolorAttrs = html.match(/\bbgcolor\s*=\s*["']/gi)?.length ?? 0;
      const colorAttrs = html.match(/\bcolor\s*=\s*["']/gi)?.length ?? 0;
      if (bgcolorAttrs + colorAttrs > 5) {
        push("inline_styling", "Heavy inline styling", 5, `${bgcolorAttrs + colorAttrs} bgcolor/color attrs`);
      }

      const yearNow = new Date().getFullYear();
      let maxCopyrightYear: number | null = null;
      const crRe = /©\s*(\d{4})|copyright\s*(\d{4})|&copy;\s*(\d{4})/gi;
      let cm: RegExpExecArray | null;
      while ((cm = crRe.exec(html)) !== null) {
        const y = parseInt(cm[1] || cm[2] || cm[3] || "0", 10);
        if (y >= 1900 && y <= 2100) {
          maxCopyrightYear = maxCopyrightYear === null ? y : Math.max(maxCopyrightYear, y);
        }
      }
      if (maxCopyrightYear !== null && yearNow - maxCopyrightYear >= 1) {
        push(
          "stale_copyright",
          "Possibly stale copyright year in page",
          14,
          `Latest copyright year found: ${maxCopyrightYear} (current ${yearNow})`,
        );
      }

      if (!/rel\s*=\s*["']?\s*canonical/i.test(html)) {
        push("no_canonical", "No canonical link", 3, "Missing rel=canonical");
      }
      const hasTwitterMeta =
        htmlLower.includes('name="twitter:') ||
        htmlLower.includes("name='twitter:") ||
        htmlLower.includes('property="twitter:') ||
        htmlLower.includes("property='twitter:");
      if (!hasTwitterMeta) {
        push(
          "no_twitter_card",
          "No Twitter card meta",
          5,
          "Missing twitter:* meta (name= or property=)",
        );
      }
      if (!htmlLower.includes("application/ld+json")) {
        push("no_jsonld", "No structured data", 8, "Missing JSON-LD script");
      }

      const isWordPress = techStack.some((t) => t.toLowerCase() === "wordpress");
      if (isWordPress) {
        if (/content="wordpress\s*[45]\./i.test(html)) {
          push("old_wp_version", "Old WordPress generator", 10, "Generator references WordPress 4/5");
        }
        if (
          /wp-content\/themes\/(twentyten|twentyeleven|twentytwelve|twentythirteen|twentyfourteen|twentyfifteen|twentysixteen|twentyseventeen)/i.test(
            html,
          )
        ) {
          push("old_wp_theme", "Legacy default WordPress theme path", 12, "Classic twenty* theme assets");
        }
      }

      if (contentBytes !== null && contentBytes > 5000) {
        const analyticsHints = [
          "gtag(",
          "google-analytics.com",
          "googletagmanager.com",
          "analytics.js",
          "fbq(",
          "connect.facebook.net",
          "_paq.push",
          "matomo",
          "plausible.io",
          "fathom",
        ];
        if (!analyticsHints.some((h) => htmlLower.includes(h))) {
          push("no_analytics", "No common analytics snippet", 5, "No known analytics/pixel markers");
        }
      }

      const hasUsPhonePattern = /\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(html);
      const hasTelHref = /href\s*=\s*["']tel:/i.test(html);
      if (!hasUsPhonePattern && !hasTelHref) {
        push(
          "no_phone_in_html",
          "No phone number visible on page",
          5,
          "No US-style phone pattern or tel: link in HTML",
        );
      }
    }

    if (!wafBlocked && contentBytes !== null) {
      if (contentBytes > 2_000_000) {
        push("heavy_page", "Large HTML payload", 8, `${contentBytes} bytes`);
      }
      if (contentBytes > 5_000_000) {
        push("very_heavy_page", "Very large HTML payload", 7, `${contentBytes} bytes`);
      }
    }

    const totalWeight = signals.reduce((sum, s) => sum + (s.weight || 0), 0);
    const badnessScore = Math.min(100, Math.round(totalWeight));

    console.log(
      `[audit-debug] ${rawUrl} htmlLen=${html.length} signalsFired=${signals.length} signalIds=${signals.map((s) => s.id).join(",")} wafBlocked=${wafBlocked}`,
    );

    return {
      ...base,
      fetched: true,
      finalUrl,
      statusCode: res.status,
      sslValid: url.startsWith("https:") ? true : null,
      responseTimeMs,
      contentBytes,
      badnessScore,
      signals,
      techStack,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const signals: WebsiteSignal[] = [
      {
        id: "fetch_failed",
        label: "Could not fetch website",
        weight: 55,
        detail: msg.slice(0, 200),
      },
    ];
    const totalWeight = signals.reduce((sum, s) => sum + (s.weight || 0), 0);
    const badnessScore = Math.min(100, Math.round(totalWeight));
    return {
      ...base,
      fetched: false,
      responseTimeMs: Date.now() - start,
      badnessScore,
      signals,
      error: msg.slice(0, 400),
    };
  }
}

/** Deduplicated parallel HTTP probes; each result’s `url` matches the input string for Map lookup. */
export async function auditWebsitesParallel(
  urls: string[],
  opts: AuditWebsitesParallelOpts,
): Promise<WebsiteAudit[]> {
  const unique = [...new Set(urls)];
  if (unique.length === 0) return [];
  const out: WebsiteAudit[] = new Array(unique.length);
  let next = 0;
  const conc = Math.max(1, Math.min(opts.concurrency, unique.length));
  async function worker(): Promise<void> {
    for (;;) {
      const j = next++;
      if (j >= unique.length) return;
      out[j] = await auditOneUrl(unique[j]!, opts.timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
  return out;
}
