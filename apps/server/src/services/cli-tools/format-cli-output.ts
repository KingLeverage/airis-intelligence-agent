/**
 * Turn CLI stdout (often JSON from `--agent`) into readable prose-style text.
 * Non-JSON output is returned as-is (e.g. Markdown tables from the tool).
 */

const MAX_OUT_CHARS = 96_000;
const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 40;
const MAX_OBJECT_KEYS = 60;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/** Handles BOM, log prefixes, and trailing newlines around a JSON array/object. */
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

function summarizeScalar(v: unknown): string {
  if (v === null || v === undefined) return "none";
  if (typeof v === "string") return truncate(v, 400);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return truncate(JSON.stringify(v), 400);
}

function summarizeValue(v: unknown, depth: number, seen: WeakSet<object>): string {
  if (depth > MAX_DEPTH) return "…";
  if (v === null || v === undefined) return "none";
  if (typeof v === "string") return truncate(v, 600);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v !== "object") return truncate(String(v), 400);

  if (seen.has(v as object)) return "[circular]";
  seen.add(v as object);

  if (Array.isArray(v)) {
    const n = v.length;
    const lines: string[] = [`This is a list of ${n} item(s).`];
    const cap = Math.min(n, MAX_ARRAY_ITEMS);
    for (let i = 0; i < cap; i++) {
      const item = v[i];
      const block = summarizeValue(item, depth + 1, seen);
      const indented = block
        .split("\n")
        .map((ln, j) => (j === 0 ? `${i + 1}. ${ln}` : `   ${ln}`))
        .join("\n");
      lines.push(indented);
    }
    if (n > cap) lines.push(`…and ${n - cap} more (truncated for readability).`);
    return lines.join("\n\n");
  }

  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  const lines: string[] = [`Summary (${keys.length} field(s)):`];
  let k = 0;
  for (const key of keys) {
    if (k >= MAX_OBJECT_KEYS) {
      lines.push(`…and ${keys.length - k} more keys (truncated).`);
      break;
    }
    const val = o[key];
    let rendered: string;
    if (val !== null && typeof val === "object") {
      rendered = summarizeValue(val, depth + 1, seen).replace(/\n/g, "\n   ");
    } else {
      rendered = summarizeScalar(val);
    }
    lines.push(`- ${key}: ${rendered}`);
    k++;
  }
  return lines.join("\n");
}

export function formatCliOutputAsReadable(stdout: string, stderr: string): string {
  const head = stdout.slice(0, MAX_OUT_CHARS).trim();
  const err = stderr.trim();

  const parts: string[] = [];

  if (err) {
    parts.push("Tool messages (stderr):\n" + truncate(err, 8000));
  }

  if (!head) {
    return parts.length ? parts.join("\n\n") : "The command finished with no printed output.";
  }

  const parsed = extractJsonValue(head);
  if (parsed != null) {
    const seen = new WeakSet<object>();
    parts.push("Readable summary (from JSON):\n" + summarizeValue(parsed, 0, seen));
    parts.push("\n---\nRaw output (excerpt):\n" + truncate(head, 24_000));
    return parts.join("\n");
  }

  if (parts.length) {
    return parts.join("\n\n") + "\n\n---\n\nRaw output:\n" + truncate(head, 48_000);
  }
  return truncate(head, MAX_OUT_CHARS);
}
