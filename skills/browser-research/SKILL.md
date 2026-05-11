# Browser Research

## When to use
- Inspecting or interacting with the current page (elements, forms, links).
- Capturing page state into a widget after navigation.

## Behavior
1. Read **runtime context** and **Browser Context** for `interactivePreview` ids before `browser.click` / `browser.type`.
2. Use `browser.navigate` with a normal HTTPS URL when the user provides one.
3. After meaningful page changes, offer a short **note** or **html-card** capturing key facts.

## Boundaries
- Target ids must exist in the latest transcription preview.
- Do not bypass validation or invent element ids.
