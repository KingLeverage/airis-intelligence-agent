# HTML Card Video Repair

## When to use

- The user wants to add a YouTube embed to an `html-card` widget.
- An existing `html-card` has the wrong video, a placeholder iframe, or a "demo only" footer and the user wants the real video.

## Behavior

1. **Get a real video id.** Emit `browser.navigate` to a YouTube results URL or Google video search for the user's topic.
2. **Update the existing card, don't create a new one if one exists.** Use `widget.update` with the existing `html-card`'s `widgetId` from Runtime context `widgets`. The new `payload.html` must use **real `VIDEO_ID` values** from Browser context in both the `iframe src` (`https://www.youtube.com/embed/VIDEO_ID`) and any `watch?v=VIDEO_ID` links.
3. If `widget.update` isn't viable (e.g. the card is malformed), `widget.delete` + `widget.create` is the fallback.
4. If you have no real ids in context, `browser.navigate` first, then say you'll materialize the embed on the next turn once Browser JSON has populated.

Example — navigate then update:

<<<EXECUTION
type: browser.navigate
url: https://www.youtube.com/results?search_query=your+topic
payload:
{}
>>>END

<<<EXECUTION
type: widget.update
widgetId: 00000000-0000-4000-8000-000000000099
targetSpace: current
payload:
{"html":"<p>Use real VIDEO_ID from Browser context in iframe src and links.</p>"}
>>>END

## Anti-patterns

- Placeholder iframes like `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ">` when the user asked for a real topic.
- "This is only a demo" or "replace with your own video id" footers when the user expects working media.
- Inventing a `widgetId` instead of reading it from Runtime context `widgets`.
- Creating a new card when an existing one was meant to be fixed.

## Fallback when ids aren't ready

If you genuinely have no real ids yet (first turn, no Browser context), use `research-card` with real YouTube URLs in `citations` instead of fake iframes. See the AIRIS widget intelligence reference for `research-card` shape.

## Boundaries

- `widget.update` `widgetId` **must** be a real id from Runtime context `widgets` — never a placeholder.
- All YouTube `VIDEO_ID`s must come from Browser context, the user's message, or citations — never invented.
