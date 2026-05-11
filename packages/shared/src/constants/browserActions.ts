/**
 * Browser action verbs for the browser subsystem API and future automation.
 * Aligns with `BrowserActionSchema` discriminated union (`type` field) in `schemas/browser.ts`.
 */
export const BROWSER_ACTIONS = ["navigate", "click", "type", "scroll", "back", "evaluate"] as const;

export type BrowserActionType = (typeof BROWSER_ACTIONS)[number];
