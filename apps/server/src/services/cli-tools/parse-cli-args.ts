/** Split operator “free text” into argv without `shell: true`. No pipes/redirection. */

const MAX_ARGS = 48;
const MAX_ARG_LEN = 512;
const MAX_ARGS_TEXT = 4000;

/** Allowed only for custom runs — basename, no path segments. */
export const CUSTOM_CLI_PROGRAMS = [
  "coingecko-pp-cli",
  "docker-hub-pp-cli",
  "pypi-pp-cli",
  "recipe-goat-pp-cli",
  "espn-pp-cli",
  "flight-goat-pp-cli",
  "movie-goat-pp-cli",
  "twilio-pp-cli",
  "x-twitter-pp-cli",
  "scrape-creators-pp-cli",
] as const;
export type CustomCliProgram = (typeof CUSTOM_CLI_PROGRAMS)[number];

export function isCustomCliProgram(s: string): s is CustomCliProgram {
  return (CUSTOM_CLI_PROGRAMS as readonly string[]).includes(s);
}

/** NBSP / narrow no-break space often pasted from the web — treat as normal space before charset check. */
function normalizeArgText(a: string): string {
  return a.replace(/\u00a0/g, " ").replace(/\u202f/g, " ").replace(/\u2009/g, " ");
}

function dangerousArg(a: string): string | null {
  if (a.length > MAX_ARG_LEN) return "arg_too_long";
  const n = normalizeArgText(a);
  // Block shell / injection metacharacters only (no shell: true — still keep argv boring).
  if (/[\n\r\0;$`!|&<>{}[\]\\]/.test(n)) return "arg_forbidden_char";
  if (n.includes("..")) return "arg_forbidden_sequence";
  // Allow any printable / natural-language token (Unicode recipes, spaces inside quotes, emoji).
  // Reject ASCII & C1 control chars only — not "encoding" issues; pasting from the web often adds NBSP (normalized above).
  if (/\p{Cc}/u.test(n)) return "arg_bad_charset";
  return null;
}

/** Minimal quote-aware splitter (single/double quotes). */
export function parseArgsText(raw: string): string[] {
  const s = raw.trim().slice(0, MAX_ARGS_TEXT);
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) {
        quote = null;
        continue;
      }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur.length) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function validateCustomArgv(argv: string[]): { ok: true; argv: string[] } | { ok: false; message: string } {
  if (argv.length > MAX_ARGS) return { ok: false, message: "too_many_args" };
  for (const a of argv) {
    const bad = dangerousArg(a);
    if (bad) return { ok: false, message: bad };
  }
  return { ok: true, argv };
}
