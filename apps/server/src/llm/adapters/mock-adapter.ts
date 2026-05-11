import type { ModelCompletionAdapter, ModelCompletionContext } from "./types.js";

const NOTE_PHRASES = [
  "create a note",
  "make a note",
  "add a note",
  "save this as a note",
  "save as a note",
];

function escapeJsonString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").slice(0, 2000);
}

function extractUrlFromMessage(userMessage: string): string {
  const m = userMessage.match(/https?:\/\/[^\s)\]]+/i);
  if (m) return m[0];
  if (/example\.com/i.test(userMessage)) return "https://example.com";
  return "https://www.google.com/";
}

/** Strip trailing prose so the query fits a search URL. */
function trimSearchQueryTail(raw: string): string {
  return raw
    .replace(/\s+in\s+the\s+(?:open\s+)?browser.*$/i, "")
    .replace(/\s+from\s+the\s+past\s+\d+\s*(?:hours?|days?|weeks?).*$/i, "")
    .replace(/\s+for\s+me\b.*$/i, "")
    .replace(/\s+right\s+now\s*$/i, "")
    .replace(/\s+now\s*[.?!…]*\s*$/i, "")
    .replace(/[.?!…]+$/u, "")
    .trim();
}

/**
 * Natural-language web lookup → always navigate to a search-results URL.
 * The in-app preview strips scripts; typing into google.com does nothing — URLs must carry the query.
 */
function tryExtractWebSearchQuery(userMessage: string): string | null {
  const patterns: RegExp[] = [
    /\bsearch\s+(?:the\s+(?:web|internet)\s+)?for\s+(.+)/i,
    /\bhelp\s+me\s+search\s+for\s+(.+)/i,
    /\bI'll\s+search\s+for\s+(.+)/i,
    /\b(?:google|web)\s+search\s+(?:for\s+)?(.+)/i,
    /\bfind\s+(?:the\s+)?(?:latest\s+)?(?:news|information|info|results|updates)\s+(?:about|on|regarding)\s+(.+)/i,
    /\b(?:latest\s+)?news\s+(?:about|on|regarding)\s+(.+)/i,
    /\bwhat(?:'s|s|\s+is)\s+the\s+latest\s+(?:news\s+)?(?:about|on)\s+(.+)/i,
    /\blook\s+up\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = userMessage.match(re);
    if (!m?.[1]) continue;
    let q = trimSearchQueryTail(m[1]);
    if (/^(how|why|what|whether|if)\b/i.test(q)) continue;
    if (q.length >= 2 && q.length <= 400) return q;
  }
  return null;
}

function emitNavigateToSearchResults(query: string): string {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return `🔎 Pulling up **search results** in the browser — the preview mirrors them as readable HTML (no fake “typing into Google” needed).

<<<EXECUTION
type: browser.navigate
targetSpace: current
payload:
{"url":"${escapeJsonString(url)}"}
>>>END`;
}

/** YTD / "this year" movie & box-office asks → Google results URL (static preview). */
function inferBoxOfficeSearchQuery(userMessage: string): string | null {
  const t = userMessage.toLowerCase();
  const hasFilmContext =
    /\b(movie|film|films|movies|cinema|box\s+office|grossing|blockbuster|theater|theatre)\b/i.test(t);
  if (!hasFilmContext) return null;

  const wantsRankingsOrSheet =
    /\b(spreadsheet|table|csv|list|rank|ranking|top|highest|best|biggest|gross|domestic|worldwide|ytd|year to date|released so far|so far|this year|selling)\b/i.test(t) ||
    /\bmovies?\s+that\s+(?:have\s+been\s+)?released\b/i.test(t);

  if (!wantsRankingsOrSheet) return null;

  const explicitYear = userMessage.match(/\b(20[0-2]\d)\b/)?.[1];
  const year = explicitYear ?? String(new Date().getFullYear());
  return `US domestic box office highest grossing movies ${year} year to date`;
}

/**
 * Deterministic mock: note widget, browser navigate/back/click (rule-based), or fallback blurb.
 */
export function mockModelRawText(userMessage: string): string {
  const t = userMessage.toLowerCase();
  const wantsNote = NOTE_PHRASES.some((p) => t.includes(p)) || /\bnote\b/.test(t);

  if (wantsNote) {
    const body = userMessage.trim() || "Empty note";
    return `✨ Saved that in a **note** widget for you.

<<<EXECUTION
type: widget.create
widgetKind: note
title: Note
targetSpace: current
payload:
{"content":"${escapeJsonString(body)}"}
>>>END`;
  }

  const wantsCryptoDash =
    /\bcrypto\b/.test(t) && /\b(dashboard|workspace|markets)\b/.test(t);

  if (wantsCryptoDash) {
    return `🚀 Laying out a **crypto dashboard** — tickers, chart, and headlines in one sweep.

<<<EXECUTION
type: workspace.compose
targetSpace: current
payload:
{"recipe":"crypto-dashboard"}
>>>END`;
  }

  const wantsBack =
    /\b(go back|back in the browser)\b/.test(t) ||
    (/\bback\b/.test(t) && /\b(browser|page)\b/.test(t));

  if (wantsBack) {
    return `↩️ Stepping **back** one page in the browser session.

<<<EXECUTION
type: browser.back
targetSpace: current
payload:
{}
>>>END`;
  }

  const boxOfficeQuery = inferBoxOfficeSearchQuery(userMessage);
  if (boxOfficeQuery) {
    return `${emitNavigateToSearchResults(boxOfficeQuery)}

Once the preview shows titles and numbers, send another message asking to **build a comparison-panel from the browser text** (mock mode is rule-based; use **Model & API settings** with a real model for a full auto-filled grid).`;
  }

  const webSearchQuery = tryExtractWebSearchQuery(userMessage);
  if (
    webSearchQuery &&
    /\b(search|news|google|lookup|look\s+up|find|headlines|results)\b/i.test(userMessage)
  ) {
    return emitNavigateToSearchResults(webSearchQuery);
  }

  /** “Open the browser” has no URL — still must emit browser.navigate so the UI opens from Home. */
  const wantsOpenBrowserPanel =
    /\bopen\s+(the\s+)?browser\b/i.test(userMessage) ||
    /\b(show|launch|display)\s+(the\s+)?browser\b/i.test(userMessage);

  const wantsGoogleHome =
    /\b(navigate|go|head)\s+(to\s+)?google\b/i.test(userMessage) ||
    /\bopen\s+google\b/i.test(t) ||
    (/\bgoogle\b/.test(t) && /\b(browser|tab|page)\b/.test(t) && /\b(open|show|visit|load)\b/i.test(userMessage));

  if (wantsOpenBrowserPanel || wantsGoogleHome) {
    const url = "https://www.google.com/";
    return `🌐 **Google** is open in the workspace browser — say what you want to look up next.

<<<EXECUTION
type: browser.navigate
targetSpace: current
payload:
{"url":"${escapeJsonString(url)}"}
>>>END`;
  }

  const urlMatch = userMessage.match(/https?:\/\/[^\s)\]"']+/i);
  const urlInMessage = urlMatch ? urlMatch[0] : "";
  const bareUrlLine = Boolean(urlInMessage && /^\s*https?:\/\/\S+\s*$/i.test(userMessage.trim()));
  const inBrowserPhrase = /\bin\s+the\s+browser\b/i.test(userMessage);
  const mentionsExampleCom = /example\.com/i.test(userMessage);

  /** Must not require `https://` in the message: tutorials say “open example.com in the browser”. */
  const wantsNavigateLoose =
    bareUrlLine ||
    (Boolean(urlInMessage) &&
      (/\b(open|navigate|visit|load|show|browse|go to|goto|see|check)\b/i.test(userMessage) ||
        /\b(browser|tab|page|site|url|link)\b/i.test(userMessage) ||
        inBrowserPhrase)) ||
    (inBrowserPhrase && mentionsExampleCom) ||
    (/\b(open|navigate|visit|load)\b/i.test(t) && mentionsExampleCom);

  const wantsNavigate =
    wantsNavigateLoose ||
    (/\b(open|navigate|visit|load)\b/.test(t) &&
      (/https?:\/\//.test(userMessage) ||
        mentionsExampleCom ||
        (/\b(browser|workspace)\b/.test(t) && /example/.test(t))));

  if (wantsNavigate) {
    const url = urlInMessage || extractUrlFromMessage(userMessage);
    return `👀 Opening **that page** in the browser now.

<<<EXECUTION
type: browser.navigate
targetSpace: current
payload:
{"url":"${escapeJsonString(url)}"}
>>>END`;
  }

  const wantsClickPricing =
    (t.includes("click") || t.includes("press")) && t.includes("pricing");

  if (wantsClickPricing) {
    return `🖱️ Recording a click on **Pricing** (mock uses \`e2\` — swap the id to match your page snapshot).

<<<EXECUTION
type: browser.click
targetSpace: current
payload:
{"targetId":"e2"}
>>>END`;
  }

  const wantsNewWorkspace =
    /\b(create|new|add)\s+(?:a\s+)?(?:workspace|space)\b/i.test(userMessage) ||
    /\bworkspace\s+from\s+scratch\b/i.test(t);

  if (wantsNewWorkspace) {
    const nameMatch = userMessage.match(
      /(?:called|named)\s+["']?([^"'\n]{1,120}?)["']?(?:\s*[.?!]|$)/i,
    );
    const tail = userMessage.replace(/^[\s\S]*?\b(?:workspace|space)\b/i, "").trim();
    const fromQuotes = userMessage.match(/["']([^"'\n]{1,120})["']/);
    const name =
      (nameMatch?.[1] ?? fromQuotes?.[1] ?? tail.replace(/^[:\s]+/, "").split(/[.?!]/)[0] ?? "New workspace")
        .trim()
        .slice(0, 120) || "New workspace";
    return `📁 Creating a **new workspace** for you.

<<<EXECUTION
type: space.create
title: ${name.replace(/:/g, " ")}
payload:
{"name":"${escapeJsonString(name)}"}
>>>END`;
  }

  const delUuid = userMessage.match(
    /\b(?:delete|remove)\s+(?:workspace|space)\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/i,
  );
  if (delUuid?.[1]) {
    const sid = delUuid[1];
    return `🗑 Removing that **workspace** by id.

<<<EXECUTION
type: space.delete
payload:
{"spaceId":"${sid}"}
>>>END`;
  }

  return `Mock mode — ask to open the browser, paste a URL, create a note, create/delete a workspace (paste a space UUID to delete), or switch to a real model in Model & API settings.`;
}

export class MockModelAdapter implements ModelCompletionAdapter {
  async complete(ctx: ModelCompletionContext): Promise<string> {
    void ctx.systemPrompt;
    return mockModelRawText(ctx.userMessage);
  }
}
