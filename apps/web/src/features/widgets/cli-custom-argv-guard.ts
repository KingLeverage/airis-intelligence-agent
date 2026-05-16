/**
 * Custom argv is tokenized like a shell argv (no NL / `;` / `&`). Operators sometimes paste a full English sentence.
 */
export function customArgvLooksLikeProse(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  if (/--[\w-]+/.test(t)) return false;
  if (/^(doctor|version|help|sync)\b/i.test(t)) return false;
  return /\b(the|and|that|this|with|from|about|please|summarize|results|recent|search for|run scrape|creators to)\b/i.test(
    t,
  );
}
