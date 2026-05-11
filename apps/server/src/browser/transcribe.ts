import * as cheerio from "cheerio";
import type { BrowserFormField, BrowserPageTranscription, InteractiveElement } from "@airis/shared";

/** DOM query groups in order — must match `injectAirisElementIds` in playwright-runtime. */
export const INTERACTIVE_SELECTOR_GROUPS = [
  "a[href]",
  'button, input[type="submit"], input[type="button"], [role="button"]',
  "[role=link]",
  'input:not([type=hidden]):not([type=submit]):not([type=button])',
  "textarea",
  "select",
] as const;

/** Basic SSRF guard for server-side fetch transcribe. Set TRANSCRIBE_ALLOW_PRIVATE=1 to disable. */
export function isTranscribeUrlBlocked(url: string): boolean {
  if (process.env.TRANSCRIBE_ALLOW_PRIVATE === "1") return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (!/^https?:$/i.test(u.protocol)) return true;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (host === "[::1]" || host === "::1") return true;
  return false;
}

const CAP_INTERACTIVE = 80;
const CAP_FORMS = 40;
const CAP_SUMMARY = 900;

function nowIso(): string {
  return new Date().toISOString();
}

function dedupePush(parts: string[], seen: Set<string>, text: string, maxLen = 200): void {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2) return;
  const slice = t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  const key = slice.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  parts.push(slice);
}

function extractVisibleTextSummary($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  $("h1,h2,h3,h4,nav a,button,a[href],[role=button],[role=link],label,p,li,td,th,figcaption")
    .not("script, style, noscript")
    .each((_, el) => {
      dedupePush(parts, seen, $(el).text(), 240);
    });
  const joined = parts.join(" · ");
  return joined.length > CAP_SUMMARY ? `${joined.slice(0, CAP_SUMMARY)}…` : joined;
}

function fieldLabel($: cheerio.CheerioAPI, $f: cheerio.Cheerio<any>): string {
  const id = $f.attr("id");
  if (id) {
    const lab = $("label")
      .filter((_, l) => $(l).attr("for") === id)
      .first()
      .text()
      .trim();
    if (lab) return lab;
  }
  const aria = $f.attr("aria-label")?.trim();
  if (aria) return aria;
  const ph = $f.attr("placeholder")?.trim();
  if (ph) return ph;
  const name = $f.attr("name")?.trim();
  if (name) return name;
  return $f.attr("type") ?? "field";
}

function hintForInteractive($el: cheerio.Cheerio<any>, fallback: string): string {
  const aid = $el.attr("data-airis-id")?.trim();
  if (aid && /^e\d+$/i.test(aid)) return `[data-airis-id="${aid.toLowerCase()}"]`;
  return fallback;
}

function mockTranscription(url: string): BrowserPageTranscription {
  return {
    url,
    title: "Mock page",
    visibleTextSummary:
      "Mock transcription. Use fetch mode with a public http(s) URL when the server can reach the network.",
    interactiveElements: [
      { id: "e0", role: "button", label: "Submit", text: "Submit", selectorHint: "button#submit" },
      { id: "e1", role: "link", label: "Docs", text: "Docs", selectorHint: "a.docs" },
      { id: "e2", role: "textbox", label: "Search", text: "", selectorHint: "input[name=q]" },
    ],
    forms: [
      { id: "f0", label: "Query", type: "text", valueHint: "search terms" },
    ],
    scrollPosition: 0,
    capturedAt: nowIso(),
  };
}

function resolveCanonicalUrl(pageUrl: string, $: cheerio.CheerioAPI): string {
  const href = $('link[rel="canonical"]').first().attr("href")?.trim();
  if (!href) return pageUrl;
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return pageUrl;
  }
}

/** Build transcription from HTML (e.g. fetch body or Playwright `page.content()`). */
export function transcribeHtml(html: string, pageUrl: string): BrowserPageTranscription {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const finalUrl = resolveCanonicalUrl(pageUrl, $);
  const title = $("title").first().text().trim() || finalUrl;
  const summary = extractVisibleTextSummary($);

  const interactiveElements: InteractiveElement[] = [];
  let eid = 0;

  const pushInteractive = (el: InteractiveElement) => {
    if (interactiveElements.length >= CAP_INTERACTIVE) return false;
    interactiveElements.push(el);
    return true;
  };

  INTERACTIVE_SELECTOR_GROUPS.forEach((groupSel, gi) => {
    if (interactiveElements.length >= CAP_INTERACTIVE) return;
    $(groupSel).each((_, el) => {
      if (interactiveElements.length >= CAP_INTERACTIVE) return false;
      const $el = $(el);
      if ($el.closest("script, style, noscript").length) return;

      const tag = el.tagName?.toLowerCase() ?? "";

      if (gi === 0) {
        const t = $el.text().trim().slice(0, 120);
        pushInteractive({
          id: `e${eid++}`,
          role: "link",
          label: t || "link",
          text: t || undefined,
          selectorHint: hintForInteractive($el, "a[href]"),
        });
        return;
      }
      if (gi === 1) {
        const t = $el.text().trim() || ($el.attr("value") ?? "button");
        pushInteractive({
          id: `e${eid++}`,
          role: "button",
          label: t.slice(0, 120),
          text: t.slice(0, 120),
          selectorHint: hintForInteractive($el, tag || "button"),
        });
        return;
      }
      if (gi === 2) {
        const t = $el.text().trim().slice(0, 120);
        pushInteractive({
          id: `e${eid++}`,
          role: "link",
          label: t || "link",
          text: t || undefined,
          selectorHint: hintForInteractive($el, "[role=link]"),
        });
        return;
      }
      if (gi === 3) {
        const type = ($el.attr("type") ?? "text").toLowerCase();
        const lab = fieldLabel($, $el);
        pushInteractive({
          id: `e${eid++}`,
          role: type === "checkbox" ? "checkbox" : type === "radio" ? "radio" : "textbox",
          label: lab.slice(0, 120),
          text: ($el.attr("value") ?? "").slice(0, 80) || undefined,
          selectorHint: hintForInteractive(
            $el,
            $el.attr("name") ? `input[name=${$el.attr("name")}]` : "input",
          ),
        });
        return;
      }
      if (gi === 4) {
        pushInteractive({
          id: `e${eid++}`,
          role: "textbox",
          label: fieldLabel($, $el).slice(0, 120),
          text: undefined,
          selectorHint: hintForInteractive($el, "textarea"),
        });
        return;
      }
      if (gi === 5) {
        pushInteractive({
          id: `e${eid++}`,
          role: "combobox",
          label: fieldLabel($, $el).slice(0, 120),
          text: undefined,
          selectorHint: hintForInteractive($el, "select"),
        });
      }
    });
  });

  const forms: BrowserFormField[] = [];
  let fid = 0;
  $("input:not([type=hidden]), textarea, select").each((_, field) => {
    if (forms.length >= CAP_FORMS) return false;
    const $f = $(field);
    const tag = field.tagName.toLowerCase();
    const type =
      tag === "textarea" ? "textarea" : tag === "select" ? "select" : ($f.attr("type") ?? "text").toLowerCase();
    const val = ($f.attr("value") ?? "").trim();
    const ph = ($f.attr("placeholder") ?? "").trim();
    forms.push({
      id: `f${fid++}`,
      label: fieldLabel($, $f).slice(0, 160),
      type,
      valueHint: ph || (val ? val.slice(0, 64) : undefined),
    });
    return undefined;
  });

  return {
    url: finalUrl,
    title,
    visibleTextSummary: summary || title,
    interactiveElements,
    forms,
    scrollPosition: 0,
    capturedAt: nowIso(),
  };
}

export async function transcribeUrl(url: string, mode: "mock" | "fetch"): Promise<BrowserPageTranscription> {
  if (mode === "mock" || url === "about:blank") {
    return mockTranscription(url);
  }

  if (isTranscribeUrlBlocked(url)) {
    return {
      ...mockTranscription(url),
      title: "Blocked URL",
      visibleTextSummary:
        "Transcription fetch blocked for private/local URLs. Set TRANSCRIBE_ALLOW_PRIVATE=1 to allow (dev only).",
    };
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AIRIS-Intelligence-Agent/0.1 (transcribe)" },
    });
    if (!res.ok) {
      return {
        ...mockTranscription(url),
        title: `HTTP ${res.status}`,
        visibleTextSummary: `Fetch failed: ${res.status} ${res.statusText}`.slice(0, CAP_SUMMARY),
      };
    }
    const html = await res.text();
    const pageUrl = res.url || url;
    return transcribeHtml(html, pageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...mockTranscription(url),
      title: "Fetch error",
      visibleTextSummary: msg.slice(0, 480),
    };
  }
}
