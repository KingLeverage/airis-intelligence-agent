import type { BrowserAction, BrowserSession } from "./schemas/browser.js";

const MAX_SUMMARY_CHARS = 520;
const MAX_INTERACTIVE = 14;
const MAX_FORMS = 10;

function formatActionLine(a: BrowserAction): string {
  switch (a.type) {
    case "navigate":
      return `navigate ${a.url}`;
    case "click":
      return `click ${a.targetId}`;
    case "type":
      return `type ${a.targetId} "${a.text.slice(0, 48)}${a.text.length > 48 ? "…" : ""}"`;
    case "scroll":
      return `scroll ${a.amount}`;
    case "back":
      return "back";
    case "evaluate":
      return `evaluate ${a.scriptPreview}`;
  }
}

export type BuildBrowserPromptContextOptions = {
  includeRecentActions?: boolean;
  maxRecentActions?: number;
};

/**
 * Compact, model-oriented excerpt from the latest browser transcription + optional action tail.
 * Intended for optional inclusion in agent prompts (not raw HTML).
 */
export function buildBrowserPromptContext(
  session: BrowserSession,
  options: BuildBrowserPromptContextOptions = {},
): string {
  const { includeRecentActions = true, maxRecentActions = 8 } = options;
  const t = session.lastTranscription;
  const url = session.currentUrl ?? t?.url;
  if (!t && !url) {
    return "Browser: (no page loaded)";
  }

  const lines: string[] = [];
  lines.push(`URL: ${url ?? "unknown"}`);
  if (!t) {
    if (includeRecentActions && session.actions.length) {
      lines.push("Recent actions:");
      for (const a of session.actions.slice(-maxRecentActions)) {
        lines.push(`- ${formatActionLine(a)}`);
      }
    }
    return lines.join("\n");
  }

  lines.push(`Title: ${t.title}`);
  lines.push(`Summary: ${t.visibleTextSummary.slice(0, MAX_SUMMARY_CHARS)}`);

  const topEl = t.interactiveElements.slice(0, MAX_INTERACTIVE);
  if (topEl.length) {
    lines.push("Interactive:");
    for (const e of topEl) {
      const extra = e.text && e.text !== e.label ? ` "${e.text.slice(0, 72)}"` : "";
      lines.push(`- ${e.id} | ${e.role} | ${e.label}${extra}`);
    }
  }

  const topForms = t.forms.slice(0, MAX_FORMS);
  if (topForms.length) {
    lines.push("Forms:");
    for (const f of topForms) {
      const hint = f.valueHint ? ` | ${f.valueHint.slice(0, 48)}` : "";
      lines.push(`- ${f.id} | ${f.label} | ${f.type}${hint}`);
    }
  }

  if (includeRecentActions && session.actions.length) {
    lines.push("Recent actions:");
    for (const a of session.actions.slice(-maxRecentActions)) {
      lines.push(`- ${formatActionLine(a)}`);
    }
  }

  return lines.join("\n");
}
