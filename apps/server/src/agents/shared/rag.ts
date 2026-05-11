import { WIDGET_SPECS, type WidgetSpec } from "@airis/shared";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function docText(spec: WidgetSpec): string {
  const parts = [
    spec.title,
    spec.description,
    ...(spec.tags ?? []),
    spec.category ?? "",
    ...(spec.techStack ?? []),
    spec.buildPrompt ?? "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** TF–IDF vectors + cosine similarity (in-memory, boot-time corpus from shared package). */
export function retrieveWidgetSpecs(query: string, topK = 3): WidgetSpec[] {
  const specs = WIDGET_SPECS;
  if (specs.length === 0 || !query.trim()) return [];

  const docs = specs.map(docText);
  const N = docs.length;
  const docTokens = docs.map(tokenize);

  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  function idf(term: string): number {
    const d = df.get(term) ?? 0;
    return Math.log((N + 1) / (d + 1)) + 1;
  }

  function tfidfVec(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    const len = tokens.length || 1;
    const out = new Map<string, number>();
    for (const [term, c] of tf) {
      out.set(term, (c / len) * idf(term));
    }
    return out;
  }

  const docVecs = docTokens.map((tokens) => tfidfVec(tokens));
  const qVec = tfidfVec(tokenize(query));

  function cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const v of a.values()) na += v * v;
    for (const v of b.values()) nb += v * v;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      dot += (a.get(k) ?? 0) * (b.get(k) ?? 0);
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 0 ? dot / denom : 0;
  }

  const ranked = specs.map((spec, i) => ({
    spec,
    score: cosine(qVec, docVecs[i]!),
  }));
  ranked.sort((x, y) => y.score - x.score);
  return ranked.slice(0, topK).map((r) => r.spec);
}
