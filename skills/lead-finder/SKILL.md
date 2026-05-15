# Lead Finder

## When to use

- The user asks to **find**, **pull**, **get**, or **list** local businesses (any kind: trades, contractors, retailers, professional services, medical practices, restaurants, shops, agencies) in or near a location.
- The user says "leads" or "prospects" referring to local businesses.
- Even without an explicit location, requests like "find dentists with bad websites" or "20 HVAC contractors" qualify.

## Behavior

1. Emit a brief one-sentence acknowledgement ("On it — pulling 20 plumbers in Boise now.") followed by **one** `workflow.run` execution block in the **same reply**.
2. **Never** ask clarifying questions first. **Never** promise to search and then send a turn with no execution block.
3. **Never** hand-author a `widget.create` with `widgetKind: lead-finder`. The server pipeline (Maps scrape + website audit + widget creation) only fires via `workflow.run`.

## Payload shape

- `name` (string, required): must be `"lead-finder"`.
- `query` (string, 1–200 chars): the business **type / trade**, not a sentence. Examples: `"plumber"`, `"window replacement"`, `"roofer"`, `"dentist"`, `"electrician"`, `"HVAC contractor"`, `"med spa"`, `"chiropractor"`, `"law firm"`, `"auto body shop"`.
- `location` (optional string, ≤120 chars): the city/region the user mentioned. Appended as ` in <location>` unless `query` already contains it.
- `maxResults` (optional int 1–60, default **20**): cap on businesses after ranking.

## Examples

**A** — user: "find me 20 plumbers in Boise"
Reply: "On it — pulling 20 plumbers in Boise now."
<<<EXECUTION
type: workflow.run
targetSpace: current
payload:
{"name":"lead-finder","query":"plumber","location":"Boise ID","maxResults":20}
>>>END

**B** — user: "I need 20 window replacement companies in Boise"
Reply: "Sure — running the window-replacement lead search for Boise."
<<<EXECUTION
type: workflow.run
targetSpace: current
payload:
{"name":"lead-finder","query":"window replacement","location":"Boise ID","maxResults":20}
>>>END

**C** — user: "show me 15 roofers near Denver"
Reply: "Pulling 15 Denver roofers."
<<<EXECUTION
type: workflow.run
targetSpace: current
payload:
{"name":"lead-finder","query":"roofer","location":"Denver CO","maxResults":15}
>>>END

**D** — quality filter, no explicit location: "find dentists with bad websites"
Reply: "Searching now."
<<<EXECUTION
type: workflow.run
targetSpace: current
payload:
{"name":"lead-finder","query":"dentist with bad website","maxResults":20}
>>>END

**E** — user: "get me 30 HVAC contractors in Phoenix"
Reply: "Pulling 30 Phoenix HVAC contractors."
<<<EXECUTION
type: workflow.run
targetSpace: current
payload:
{"name":"lead-finder","query":"HVAC contractor","location":"Phoenix AZ","maxResults":30}
>>>END

## Anti-patterns

**WRONG** — promise without execution:
> "I'll search for 20 window replacement companies in Boise for you. Please hold on while I perform this action."
*(no execution block — model promised but failed to act)*

**RIGHT** — same user message:
> "On it — searching now."
> [followed by the `workflow.run` block]

## Boundaries

- `targetSpace` is always `current` (omit or set explicitly).
- One `workflow.run` per turn — do not stack lead-finder calls.
- If the user asks for something the lead-finder cannot do (e.g. "rank these by revenue"), reply in prose; do not invent fields outside the payload shape above.
