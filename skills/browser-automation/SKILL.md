# Browser Automation

## When to use

- The user asks you to open, navigate to, search, or interact with a web page.
- The user asks for current movie / box-office data, "what's playing", top-grossing films, or a spreadsheet of films.
- A previous turn left a `browser` transcription in runtime context and the user wants to click, scroll, or extract from it.

## Behavior — navigate

- `browser.navigate` fetches the URL and transcribes it into workspace state.
- Use the **user's URL** or a real **search-results URL** for their query. Do **not** use `https://example.com` as a placeholder — that host is documentation-only and confuses the live preview. Only use example.com if the user explicitly asked for it.
- For **web search / news**, put the query in the URL: `https://www.google.com/search?q=<URL-encoded query>`. Do not simulate typing into the search bar and pressing Enter — the AIRIS workspace preview is **static HTML** (scripts stripped) and cannot run Google's JavaScript.

Example:

<<<EXECUTION
type: browser.navigate
url: https://www.google.com/search?q=hvac+contractors+phoenix
payload:
{}
>>>END

## Behavior — click / type / scroll / back

- `browser.click` and `browser.type` require a `targetId` (e.g. `e0`, `e1`) that exists in the current page transcription's `browser.interactivePreview`. Never invent ids.
- `browser.scroll` is logged; transcription does not currently track viewport — describe scroll intent in prose if it matters.
- `browser.back` re-fetches the previous URL from workspace history.

Examples:

<<<EXECUTION
type: browser.click
targetId: e3
payload:
{}
>>>END

<<<EXECUTION
type: browser.type
targetId: e7
text: Phoenix HVAC contractors
payload:
{}
>>>END

<<<EXECUTION
type: browser.scroll
payload:
{"amount":400}
>>>END

## Behavior — evaluate (gated)

- `browser.evaluate` runs an **async function body** in a headless Playwright tab — **not** the AIRIS in-app browser.
- Requires operator env `AIRIS_PLAYWRIGHT=1` **and** `AIRIS_PERSONAL_BROWSER_EVAL=1`, and a prior `browser.navigate` to set up the page.
- If disabled, the run is skipped with an instruction string — do **not** claim the script ran.
- If a result is empty, return diagnostics first (`document.title`, `document.body?.innerText?.length`) before assuming selectors failed. Directory SPAs often hydrate after load.

<<<EXECUTION
type: browser.evaluate
targetSpace: current
payload:
{"script":"return document.title"}
>>>END

## Static-mirror vs live caveats

- Without Playwright, the workspace preview is a **static HTML mirror** of the URL with scripts removed. Describe what the **transcription / mirror** actually contains — don't claim you "see the live page" or extracted DOM-only fields.
- **Yelp and similar directories** often return 403 to server fetches. In-app Preview mirrors those search URLs to HTML search results, not the live Yelp DOM. Don't claim Yelp-specific fields unless `AIRIS_PLAYWRIGHT=1` is on or the user opened the page in **↗** (external browser).
- With `AIRIS_PLAYWRIGHT=1` + Chromium installed (`npx playwright install chromium`), navigate/click/type/scroll get refreshed snapshots from a real browser.

## Box office / movie tables / "movies this year"

When the user asks for **top-grossing**, **highest box office**, **best-selling**, **YTD movies**, a **spreadsheet/table of films**, or **movies released so far this year**:

1. Read **`serverNow`** in Runtime JSON and derive the calendar year. Phrases like "this year" or "so far" refer to `serverNow`'s year — do **not** treat that year as the future.
2. Do **not** refuse for lacking a private real-time API. Emit `browser.navigate` **in this reply** to a real URL: an encoded Google search, Box Office Mojo's yearly chart, The Numbers, etc.
3. If `AIRIS_CLI_TOOLS=1` and the operator has Printing Press CLIs installed, you may use `cli.tool.run` with allowlisted `movie-goat-pp-cli`.
4. When Browser JSON already contains titles and gross figures in `visibleTextSummary`, follow with `widget.create` using `comparison-panel` (one `entity` per film; `metrics` keys like rank / title / domestic / worldwide) or `metric-grid` for a compact KPI strip.
5. If this is the **first** turn and the preview isn't in context yet, **navigate first**, then say you will materialize the grid on the next turn once the mirror loads.

## Anti-patterns

- Inventing `targetId`s for click/type — only ids present in the latest transcription work.
- Claiming you "typed into the search bar" or "pressed Enter" — the static mirror can't run JS.
- Saying "I can't access real-time data" when a `browser.navigate` URL or `movie-goat-pp-cli` could obtain the list.
- Using `https://example.com` as a placeholder.
- Reporting Yelp DOM fields when only the static mirror is available.

## Boundaries

- All `targetId`s must exist in the current transcription's `interactivePreview`.
- URLs for `browser.navigate` must be normal web URLs (HTTPS recommended).
- `browser.evaluate` is opt-in via env flags; assume off unless context says otherwise.
