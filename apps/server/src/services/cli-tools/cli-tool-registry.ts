/** Allowlisted Printing Press / host CLIs — basename only, no shell. */

const PROGRAM_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export type CliToolDefinition = {
  key: string;
  label: string;
  description: string;
  /** Shown in the catalog UI (install is operator responsibility). */
  installHint: string;
  program: string;
  args: string[];
  timeoutMs?: number;
  maxBuffer?: number;
};

function assertProgram(name: string): void {
  if (!PROGRAM_RE.test(name)) {
    throw new Error(`cli_tool_invalid_program:${name}`);
  }
}

/** Stable grouping for the CLI catalog UI (presets + custom argv). */
export function familyMetaForCliProgram(program: string): { familyId: string; familyLabel: string } {
  switch (program) {
    case "coingecko-pp-cli":
      return { familyId: "coingecko", familyLabel: "CoinGecko" };
    case "docker-hub-pp-cli":
      return { familyId: "docker-hub", familyLabel: "Docker Hub" };
    case "pypi-pp-cli":
      return { familyId: "pypi", familyLabel: "PyPI" };
    case "recipe-goat-pp-cli":
      return { familyId: "recipe-goat", familyLabel: "Recipe Goat" };
    case "espn-pp-cli":
      return { familyId: "espn", familyLabel: "ESPN" };
    case "flight-goat-pp-cli":
      return { familyId: "flight-goat", familyLabel: "Flight Goat" };
    case "movie-goat-pp-cli":
      return { familyId: "movie-goat", familyLabel: "Movie Goat" };
    case "twilio-pp-cli":
      return { familyId: "twilio", familyLabel: "Twilio" };
    case "x-twitter-pp-cli":
      return { familyId: "x-twitter", familyLabel: "X (Twitter)" };
    case "scrape-creators-pp-cli":
      return { familyId: "scrape-creators", familyLabel: "Scrape Creators" };
    default:
      return { familyId: program, familyLabel: program };
  }
}

const BUILTIN: CliToolDefinition[] = [
  {
    key: "pp-coingecko-ping",
    label: "CoinGecko — API ping",
    description:
      "`coingecko-pp-cli ping ping --agent` — quick API reachability. See [upstream README](https://github.com/mvanhorn/printing-press-library/tree/main/library/payments/coingecko).",
    installHint:
      "Go + `npx -y @mvanhorn/printing-press install coingecko --cli-only` (binaries in ~/go/bin). AIRIS prepends that dir when spawning.",
    program: "coingecko-pp-cli",
    args: ["ping", "ping", "--agent"],
    timeoutMs: 45_000,
  },
  {
    key: "pp-coingecko-doctor",
    label: "CoinGecko — doctor",
    description: "`coingecko-pp-cli doctor` — config and connectivity check.",
    installHint: "Same install as other CoinGecko presets.",
    program: "coingecko-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-coingecko-coins-list",
    label: "CoinGecko — coins list (agent JSON)",
    description: "`coingecko-pp-cli coins list --agent` — compact coin list for scripting.",
    installHint: "Large responses possible; AIRIS truncates very long stdout when saving to the widget.",
    program: "coingecko-pp-cli",
    args: ["coins", "list", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-coingecko-coins-markets",
    label: "CoinGecko — coins markets (agent JSON)",
    description: "`coingecko-pp-cli coins markets --agent` — market snapshot rows (can be large).",
    installHint: "May take longer on first run; uses a larger capture buffer on the server.",
    program: "coingecko-pp-cli",
    args: ["coins", "markets", "--agent"],
    timeoutMs: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-coingecko-trending",
    label: "CoinGecko — trending",
    description: "`coingecko-pp-cli coingecko-search-2 --agent` — trending coins (per upstream CLI).",
    installHint: "See upstream `coingecko-pp-cli --help` for flag details.",
    program: "coingecko-pp-cli",
    args: ["coingecko-search-2", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-coingecko-global",
    label: "CoinGecko — global market",
    description: "`coingecko-pp-cli global global --agent` — global crypto market stats.",
    installHint: "Same install as other CoinGecko presets.",
    program: "coingecko-pp-cli",
    args: ["global", "global", "--agent"],
    timeoutMs: 90_000,
  },
  {
    key: "pp-coingecko-search",
    label: "CoinGecko — search (agent JSON)",
    description: "`coingecko-pp-cli search search --agent` — search coins/categories/exchanges (broad).",
    installHint: "Narrow with flags via Custom run if the CLI supports them (see `--help`).",
    program: "coingecko-pp-cli",
    args: ["search", "search", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-docker-hub-doctor",
    label: "Docker Hub — doctor",
    description: "`docker-hub-pp-cli doctor` — API connectivity and local cache hint.",
    installHint:
      "Go + `npx -y @mvanhorn/printing-press install docker-hub --cli-only`. AIRIS prepends ~/go/bin when spawning.",
    program: "docker-hub-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-docker-hub-search",
    label: "Docker Hub — search (agent JSON)",
    description: "`docker-hub-pp-cli docker-hub-search search-repositories --agent` — repository search (public API).",
    installHint: "Use Custom run to add query flags supported by your CLI version (`docker-hub-pp-cli --help`).",
    program: "docker-hub-pp-cli",
    args: ["docker-hub-search", "search-repositories", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-pypi-doctor",
    label: "PyPI — doctor",
    description: "`pypi-pp-cli doctor` — config and connectivity check.",
    installHint:
      "Go + `npx -y @mvanhorn/printing-press install pypi --cli-only` (binaries in ~/go/bin). AIRIS prepends that dir when spawning.",
    program: "pypi-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-pypi-rss-newest",
    label: "PyPI — RSS newest packages (agent JSON)",
    description: "`pypi-pp-cli rss newest-packages --agent` — feed of newest packages on PyPI.",
    installHint:
      "See [upstream README](https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/pypi).",
    program: "pypi-pp-cli",
    args: ["rss", "newest-packages", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-pypi-rss-recent",
    label: "PyPI — RSS recent updates (agent JSON)",
    description: "`pypi-pp-cli rss recent-updates --agent` — feed of recently updated packages.",
    installHint: "Same install as other PyPI presets.",
    program: "pypi-pp-cli",
    args: ["rss", "recent-updates", "--agent"],
    timeoutMs: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-recipe-goat-doctor",
    label: "Recipe Goat — doctor",
    description: "`recipe-goat-pp-cli doctor` — config, credentials (e.g. `USDA_FDC_API_KEY`), connectivity.",
    installHint:
      "Go + `npx -y @mvanhorn/printing-press install recipe-goat --cli-only`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/food-and-dining/recipe-goat).",
    program: "recipe-goat-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-recipe-goat-goat-chocolate-cake-8",
    label: "Recipe Goat — rank (goat): chocolate cake, top 8",
    description:
      "`recipe-goat-pp-cli goat \"…\" --limit 8 --agent` — cross-site ranker (replaces removed `find` subcommand). Trust/rating are built into scoring; narrow the query for best matches.",
    installHint:
      "`foods` APIs may need `USDA_FDC_API_KEY`; `goat` uses live recipe fetches. Use Custom argv for other dishes.",
    program: "recipe-goat-pp-cli",
    args: ["goat", "popular chocolate cake for 8 servings", "--limit", "8", "--agent"],
    timeoutMs: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  },
  {
    key: "pp-espn-doctor",
    label: "ESPN — doctor",
    description: "`espn-pp-cli doctor` — config and connectivity (starter-pack / Printing Press).",
    installHint:
      "`npx -y @mvanhorn/printing-press install espn --cli-only` or `install starter-pack`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/espn).",
    program: "espn-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-flight-goat-doctor",
    label: "Flight Goat — doctor",
    description: "`flight-goat-pp-cli doctor` — config and connectivity.",
    installHint:
      "`npx -y @mvanhorn/printing-press install flight-goat --cli-only` or `install starter-pack`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/travel/flight-goat).",
    program: "flight-goat-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-movie-goat-doctor",
    label: "Movie Goat — doctor",
    description: "`movie-goat-pp-cli doctor` — config and connectivity.",
    installHint:
      "`npx -y @mvanhorn/printing-press install movie-goat --cli-only` or `install starter-pack`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/movie-goat).",
    program: "movie-goat-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-twilio-doctor",
    label: "Twilio — doctor",
    description: "`twilio-pp-cli doctor` — credentials and API reachability.",
    installHint:
      "`npx -y @mvanhorn/printing-press install twilio --cli-only`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/social-and-messaging/twilio).",
    program: "twilio-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-x-twitter-doctor",
    label: "X (Twitter) — doctor",
    description: "`x-twitter-pp-cli doctor` — auth and API reachability.",
    installHint:
      "`npx -y @mvanhorn/printing-press install x-twitter --cli-only`. See [README](https://github.com/mvanhorn/printing-press-library/tree/main/library/social-and-messaging/x-twitter).",
    program: "x-twitter-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
  {
    key: "pp-scrape-creators-doctor",
    label: "Scrape Creators — doctor",
    description: "`scrape-creators-pp-cli doctor` — API key / auth and connectivity check.",
    installHint:
      "Set `SCRAPE_CREATORS_API_KEY_AUTH` in `apps/server/.env` (see `.env.example`). Install: `npx -y @mvanhorn/printing-press install scrape-creators --cli-only` (binary `scrape-creators-pp-cli` in ~/go/bin; AIRIS prepends that dir when spawning).",
    program: "scrape-creators-pp-cli",
    args: ["doctor"],
    timeoutMs: 60_000,
  },
];

for (const t of BUILTIN) {
  assertProgram(t.program);
  for (const a of t.args) {
    if (a.length > 500) throw new Error(`cli_tool_arg_too_long:${t.key}`);
  }
}

const byKey = new Map(BUILTIN.map((t) => [t.key, t]));

/** Preset keys removed or renamed — keep resolving for saved widget runs / scripts. */
const LEGACY_TOOL_KEY_ALIASES: Record<string, string> = {
  "pp-recipe-goat-find-chocolate-cake-trust": "pp-recipe-goat-goat-chocolate-cake-8",
};

export function listCliToolCatalogPublic(): Array<{
  key: string;
  label: string;
  description: string;
  installHint: string;
  program: string;
  familyId: string;
  familyLabel: string;
}> {
  return BUILTIN.map((t) => {
    const { familyId, familyLabel } = familyMetaForCliProgram(t.program);
    return {
      key: t.key,
      label: t.label,
      description: t.description,
      installHint: t.installHint,
      program: t.program,
      familyId,
      familyLabel,
    };
  });
}

export function getCliToolByKey(key: string): CliToolDefinition | undefined {
  const resolved = LEGACY_TOOL_KEY_ALIASES[key] ?? key;
  return byKey.get(resolved);
}
