/**
 * Rich rendering for CLI stdout when it matches known `--agent` JSON shapes
 * (e.g. Scrape Creators `linkedin list-ads`).
 */

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function extractJsonValue(text: string): unknown | null {
  const t = text.trim().replace(/^\uFEFF/, "");
  if (!t) return null;
  const direct = tryParseJson(t);
  if (direct != null) return direct;
  const i0 = t.indexOf("[");
  const j0 = t.indexOf("{");
  if (i0 === -1 && j0 === -1) return null;
  const start = i0 === -1 ? j0 : j0 === -1 ? i0 : Math.min(i0, j0);
  const endChar = t[start] === "[" ? "]" : "}";
  const end = t.lastIndexOf(endChar);
  if (end <= start) return null;
  return tryParseJson(t.slice(start, end + 1));
}

function asTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

/** Allow http(s) for outbound links; reject javascript:, data:, etc. */
function safeWebUrl(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Thumbnails: https only (avoids mixed-content noise). */
function safeImageUrl(s: string | undefined): string | null {
  const u = safeWebUrl(s);
  if (!u || !u.startsWith("https://")) return null;
  return u;
}

function pickImageUrl(ad: Record<string, unknown>): string | null {
  const direct =
    safeImageUrl(asTrimmedString(ad.image)) ??
    safeImageUrl(asTrimmedString(ad.imageUrl)) ??
    safeImageUrl(asTrimmedString(ad.thumbnail));
  if (direct) return direct;
  const nested = ad.image;
  if (nested && typeof nested === "object") {
    const o = nested as Record<string, unknown>;
    return (
      safeImageUrl(asTrimmedString(o.url)) ??
      safeImageUrl(asTrimmedString(o.src)) ??
      safeImageUrl(asTrimmedString(o.href))
    );
  }
  return null;
}

function formatTargeting(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : undefined;
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return undefined;
    }
  }
  return String(v);
}

export function getLinkedInListAdsFromStdout(stdout: string): Array<Record<string, unknown>> | null {
  const parsed = extractJsonValue(stdout);
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const results = root.results;
  if (!results || typeof results !== "object") return null;
  const ads = (results as Record<string, unknown>).ads;
  if (!Array.isArray(ads) || ads.length === 0) return null;
  const first = ads[0];
  if (!first || typeof first !== "object") return null;
  return ads as Array<Record<string, unknown>>;
}

export function hasLinkedInAdsStructuredView(stdout: string): boolean {
  return getLinkedInListAdsFromStdout(stdout) != null;
}

function LinkedInAdCard({ ad, index }: { ad: Record<string, unknown>; index: number }) {
  const advertiser = asTrimmedString(ad.advertiser) ?? `Advertiser ${index + 1}`;
  const liPage = safeWebUrl(asTrimmedString(ad.advertiserLinkedinPage));
  const dest = safeWebUrl(asTrimmedString(ad.destinationUrl));
  const headline = asTrimmedString(ad.headline);
  const description = asTrimmedString(ad.description);
  const impressions = asTrimmedString(ad.totalImpressions);
  const adType = asTrimmedString(ad.adType);
  const targeting = formatTargeting(ad.targeting);
  const img = pickImageUrl(ad);

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-700/90 bg-slate-900/70 p-3 shadow-sm shadow-black/30">
      <div className="flex gap-3">
        {img ? (
          <div className="shrink-0 overflow-hidden rounded-md border border-slate-700/80 bg-slate-950">
            <img
              src={img}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-20 w-20 object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950/80 text-[10px] text-slate-500">
            No image
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-500/90">{advertiser}</div>
          {headline ? (
            <h4 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-100">{headline}</h4>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
            {impressions ? <span>Impressions: {impressions}</span> : null}
            {adType ? <span>{adType}</span> : null}
          </div>
        </div>
      </div>
      {description ? (
        <p className="line-clamp-4 text-[11px] leading-relaxed text-slate-300">{description}</p>
      ) : null}
      {targeting ? (
        <p className="line-clamp-2 text-[10px] leading-snug text-slate-500" title={targeting}>
          Targeting: {targeting}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-2 text-[11px]">
        {liPage ? (
          <a
            href={liPage}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-slate-800/90 px-2 py-1 font-medium text-cyan-400 hover:bg-slate-800 hover:text-cyan-300"
          >
            Company on LinkedIn
          </a>
        ) : null}
        {dest ? (
          <a
            href={dest}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-slate-800/90 px-2 py-1 font-medium text-violet-300 hover:bg-slate-800 hover:text-violet-200"
          >
            Ad destination
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function CliRunLinkedInAdsGrid({ stdout }: { stdout: string }) {
  const ads = getLinkedInListAdsFromStdout(stdout);
  if (!ads) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="text-[11px] font-medium text-slate-400">
        Parsed {ads.length} LinkedIn ad record(s) from JSON — thumbnails and links below.
      </div>
      <div className="max-h-[min(520px,62vh)] overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {ads.map((ad, i) => (
            <LinkedInAdCard key={i} ad={ad} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
