const IGNORE_LINES = new Set([
  "Rating",
  "Hours",
  "All filters",
  "Ask Maps",
  "Saved",
  "Recents",
  "Get app",
  "Results",
  "Share",
  "Website",
  "Directions",
  "Book online",
  "View more",
  "Update results when map moves",
  "Layers",
  "Sponsored",
]);

const RATING_LINE = /^(\d+(?:\.\d+)?)\((\d{1,3}(?:,\d{3})*|\d+)\)$/;

const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

export type MapsBusiness = {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  reviewSnippet: string | null;
  hasWebsite: boolean;
  hasDirections: boolean;
  /** Filled by `/browser/scrape-maps` DOM harvest; always null from text-only `parseGoogleMapsResults`. */
  website: string | null;
};

function isPureRatingLine(line: string): boolean {
  return RATING_LINE.test(line.trim());
}

function stripResultsAnchor(lines: string[]): string[] {
  const idx = lines.findIndex((l) => l === "Results");
  if (idx === -1) return lines;
  return lines.slice(idx + 1);
}

/**
 * Parses plain text from `POST /api/spaces/:spaceId/browser/scrape` when the URL is a Google Maps
 * search (`https://www.google.com/maps/search/...`) into structured business rows.
 */
export function parseGoogleMapsResults(text: string): MapsBusiness[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let work = stripResultsAnchor(lines);
  const out: MapsBusiness[] = [];
  let i = 0;
  const maxRecords = 50;

  while (i < work.length && out.length < maxRecords) {
    const line = work[i] ?? "";
    if (line === "Sponsored Results" || line === "Results") {
      i += 1;
      continue;
    }
    if (
      !line ||
      IGNORE_LINES.has(line) ||
      isPureRatingLine(line) ||
      i + 1 >= work.length ||
      !RATING_LINE.test(work[i + 1] ?? "")
    ) {
      i += 1;
      continue;
    }

    const name = line;
    const ratingLine = work[i + 1] ?? "";
    const m = RATING_LINE.exec(ratingLine.trim());
    if (!m) {
      i += 1;
      continue;
    }
    const rating = parseFloat(m[1]);
    const reviewCount = parseInt(m[2].replace(/,/g, ""), 10);
    if (!Number.isFinite(rating) || !Number.isFinite(reviewCount)) {
      i += 1;
      continue;
    }

    let category: string | null = null;
    let address: string | null = null;
    const categoryLine = work[i + 2];
    if (categoryLine !== undefined && categoryLine.length > 0) {
      if (categoryLine.includes(" · ")) {
        const parts = categoryLine
          .split(" · ")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        if (parts.length > 0) {
          category = parts[0] ?? null;
          address = parts.length > 1 ? (parts[parts.length - 1] ?? null) : null;
        }
      } else {
        category = categoryLine;
        address = null;
      }
    }

    let hours: string | null = null;
    let phone: string | null = null;
    const hoursLine = work[i + 3];
    if (hoursLine !== undefined && hoursLine.length > 0) {
      if (hoursLine.includes(" · ")) {
        const idxDot = hoursLine.indexOf(" · ");
        hours = hoursLine.slice(0, idxDot).trim() || null;
        const right = hoursLine.slice(idxDot + 3);
        const pm = right.match(PHONE_RE);
        phone = pm ? pm[0] : null;
      } else {
        hours = hoursLine;
        phone = null;
      }
    }

    let reviewSnippet: string | null = null;
    for (let k = 0; k < 6 && i + 4 + k < work.length; k++) {
      const ln = work[i + 4 + k] ?? "";
      if (ln.length >= 2 && ln.startsWith('"') && ln.endsWith('"')) {
        reviewSnippet = ln.slice(1, -1);
        break;
      }
    }

    let hasWebsite = false;
    let hasDirections = false;
    for (let k = 0; k < 8 && i + 4 + k < work.length; k++) {
      const ln = work[i + 4 + k] ?? "";
      if (ln === "Website") hasWebsite = true;
      if (ln === "Directions") hasDirections = true;
    }

    let nextI = i + 8;
    for (let s = 0; s < 12 && i + 4 + s < work.length; s++) {
      if (work[i + 4 + s] === "Book online") {
        nextI = i + 4 + s + 1;
        break;
      }
    }

    out.push({
      name,
      rating,
      reviewCount,
      category,
      address,
      phone,
      hours,
      reviewSnippet,
      hasWebsite,
      hasDirections,
      website: null,
    });
    i = nextI;
  }

  return out;
}
