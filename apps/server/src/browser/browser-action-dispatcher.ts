import { v4 as uuid } from "uuid";
import type { BrowserAction, BrowserPageTranscription, BrowserSession, ParsedExecutionBlock } from "@airis/shared";
import * as browserSession from "./session-store.js";
import {
  isPersonalBrowserEvalEnabled,
  isPlaywrightBrowserEnabled,
  playwrightClickRefresh,
  playwrightEvaluateRefresh,
  playwrightGotoUrl,
  playwrightScrollRefresh,
  playwrightTypeRefresh,
} from "./playwright-runtime.js";
import { transcribeUrl } from "./transcribe.js";
import { normalizeHttpUrl } from "./url-utils.js";
import { resolveExecutionTargetId } from "../execution/target-id.js";

const MAX_ACTIONS = 500;

export type BrowserDispatchOutcome = {
  ok: boolean;
  message: string;
  detail?: string;
  implemented: boolean;
  userMessage: string;
  session: BrowserSession;
};

async function mergeTranscription(
  spaceId: string,
  userId: string,
  transcription: BrowserPageTranscription,
  action: BrowserAction,
  stack?: string[],
): Promise<BrowserSession> {
  const s = await browserSession.getSession(spaceId, userId);
  const next: BrowserSession = {
    ...s,
    ...(stack !== undefined ? { navigationStack: stack } : {}),
    currentUrl: transcription.url,
    lastTranscription: transcription,
    actions: [...s.actions, action].slice(-MAX_ACTIONS),
  };
  await browserSession.writeSession(next, userId);
  return next;
}

/**
 * Runs a chat-validated browser.* execution block against the space browser session.
 * When `AIRIS_PLAYWRIGHT=1` and Chromium is installed, navigate/click/type/scroll refresh transcription from a real page.
 */
export async function dispatchBrowserExecution(
  block: ParsedExecutionBlock,
  spaceId: string,
  userId: string,
): Promise<BrowserDispatchOutcome> {
  switch (block.type) {
    case "browser.navigate": {
      const raw = block.url ?? (typeof block.payload.url === "string" ? block.payload.url : "");
      if (!raw.trim()) {
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.navigate_missing_url",
          implemented: false,
          userMessage: "Missing URL for navigate.",
          session: s,
        };
      }
      let url: string;
      try {
        url = normalizeHttpUrl(raw.trim());
      } catch {
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.navigate_invalid_url",
          implemented: false,
          userMessage: "Invalid URL for navigate.",
          session: s,
        };
      }
      try {
        const pwTx = await playwrightGotoUrl(spaceId, url);
        const t =
          pwTx ??
          (await transcribeUrl(url, url.startsWith("http") ? "fetch" : "mock"));
        const via = pwTx ? "playwright" : "fetch";
        const session = await browserSession.applyNavigate(spaceId, t.url, t, userId, {
          recordPriorUrl: true,
        });
        return {
          ok: true,
          message: "browser_navigated",
          implemented: true,
          userMessage:
            via === "playwright"
              ? `Navigated (live browser) to ${t.title} (${t.url})`
              : `Navigated to ${t.title} (${t.url})`,
          session,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.navigate_transcribe_failed",
          detail: msg.slice(0, 400),
          implemented: false,
          userMessage: `Could not load page: ${msg.slice(0, 200)}`,
          session: s,
        };
      }
    }
    case "browser.back": {
      const s0 = await browserSession.getSession(spaceId, userId);
      const stack = [...(s0.navigationStack ?? [])];
      if (stack.length === 0) {
        const action: BrowserAction = {
          id: uuid(),
          type: "back",
          createdAt: new Date().toISOString(),
        };
        const session = await browserSession.appendAction(spaceId, action, userId);
        return {
          ok: true,
          message: "browser_back_no_history",
          implemented: false,
          userMessage:
            "No prior page in workspace history. Navigate to a URL first, then you can go back.",
          session,
        };
      }
      const prior = stack.pop()!;
      let url: string;
      try {
        url = normalizeHttpUrl(prior);
      } catch {
        url = prior;
      }
      try {
        const pwTx = await playwrightGotoUrl(spaceId, url);
        const t =
          pwTx ??
          (await transcribeUrl(url, url.startsWith("http") ? "fetch" : "mock"));
        const action: BrowserAction = {
          id: uuid(),
          type: "back",
          createdAt: new Date().toISOString(),
        };
        const session = await mergeTranscription(spaceId, userId, t, action, stack);
        const via = pwTx ? "live browser" : "fetch";
        return {
          ok: true,
          message: "browser_back",
          implemented: true,
          userMessage: `Back (${via}) to ${t.title}`,
          session,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const action: BrowserAction = {
          id: uuid(),
          type: "back",
          createdAt: new Date().toISOString(),
        };
        const session = await browserSession.appendAction(spaceId, action, userId);
        return {
          ok: false,
          message: "browser.back_transcribe_failed",
          detail: msg.slice(0, 400),
          implemented: false,
          userMessage: `Could not reload previous page: ${msg.slice(0, 160)}`,
          session,
        };
      }
    }
    case "browser.click": {
      const tid = resolveExecutionTargetId(block);
      if (tid == null) {
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.click_missing_target",
          implemented: false,
          userMessage: "Missing targetId for click.",
          session: s,
        };
      }
      const s = await browserSession.getSession(spaceId, userId);
      const tr = s.lastTranscription;
      if (!tr) {
        return {
          ok: false,
          message: "browser.click_no_page",
          implemented: false,
          userMessage: "No page loaded. Use browser.navigate first.",
          session: s,
        };
      }
      const el = tr.interactiveElements.find((e) => e.id === tid);
      if (!el) {
        return {
          ok: false,
          message: "browser.click_unknown_target",
          detail: tid,
          implemented: false,
          userMessage: `No interactive element ${tid} on the current page.`,
          session: s,
        };
      }
      const action: BrowserAction = {
        id: uuid(),
        type: "click",
        targetId: tid,
        createdAt: new Date().toISOString(),
      };
      const newTx = await playwrightClickRefresh(spaceId, userId, tid);
      if (newTx) {
        const session = await mergeTranscription(spaceId, userId, newTx, action);
        return {
          ok: true,
          message: "browser_click_done",
          implemented: true,
          userMessage: `Clicked ${tid} and refreshed the page snapshot.`,
          session,
        };
      }
      const session = await browserSession.appendAction(spaceId, action, userId);
      return {
        ok: true,
        message: "browser_click_logged",
        implemented: false,
        userMessage:
          "Click recorded. Enable AIRIS_PLAYWRIGHT=1 and run `npx playwright install chromium` for live clicks and refreshed transcription.",
        session,
      };
    }
    case "browser.type": {
      const tid = resolveExecutionTargetId(block);
      const text =
        block.text ?? (typeof block.payload.text === "string" ? block.payload.text : undefined);
      if (tid == null || text == null) {
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.type_missing_fields",
          implemented: false,
          userMessage: "browser.type requires targetId and text.",
          session: s,
        };
      }
      const s = await browserSession.getSession(spaceId, userId);
      const tr = s.lastTranscription;
      if (!tr) {
        return {
          ok: false,
          message: "browser.type_no_page",
          implemented: false,
          userMessage: "No page loaded. Use browser.navigate first.",
          session: s,
        };
      }
      const el = tr.interactiveElements.find((e) => e.id === tid);
      if (!el) {
        return {
          ok: false,
          message: "browser.type_unknown_target",
          detail: tid,
          implemented: false,
          userMessage: `No interactive element ${tid} on the current page.`,
          session: s,
        };
      }
      const action: BrowserAction = {
        id: uuid(),
        type: "type",
        targetId: tid,
        text,
        createdAt: new Date().toISOString(),
      };
      const newTx = await playwrightTypeRefresh(spaceId, userId, tid, text);
      if (newTx) {
        const session = await mergeTranscription(spaceId, userId, newTx, action);
        return {
          ok: true,
          message: "browser_type_done",
          implemented: true,
          userMessage: `Filled ${tid} and refreshed the page snapshot.`,
          session,
        };
      }
      const session = await browserSession.appendAction(spaceId, action, userId);
      return {
        ok: true,
        message: "browser_type_logged",
        implemented: false,
        userMessage:
          "Typing recorded. Enable AIRIS_PLAYWRIGHT=1 and run `npx playwright install chromium` for live input.",
        session,
      };
    }
    case "browser.evaluate": {
      const script = typeof block.payload.script === "string" ? block.payload.script : "";
      const preview = script.replace(/\s+/g, " ").trim().slice(0, 480);
      const action: BrowserAction = {
        id: uuid(),
        type: "evaluate",
        scriptPreview: preview.length > 0 ? preview : "(empty)",
        createdAt: new Date().toISOString(),
      };
      if (!isPlaywrightBrowserEnabled() || !isPersonalBrowserEvalEnabled()) {
        const session = await browserSession.appendAction(spaceId, action, userId);
        return {
          ok: true,
          message: "browser_eval_skipped",
          implemented: false,
          userMessage:
            "browser.evaluate is off. For personal solo use: set AIRIS_PLAYWRIGHT=1, run `npx playwright install chromium`, set AIRIS_PERSONAL_BROWSER_EVAL=1, restart the server, use browser.navigate, then evaluate again.",
          session,
        };
      }
      const ev = await playwrightEvaluateRefresh(spaceId, userId, script);
      if (!ev.ok) {
        if (ev.code === "no_page") {
          const s = await browserSession.getSession(spaceId, userId);
          return {
            ok: false,
            message: "browser.evaluate_no_page",
            implemented: false,
            userMessage: "No Playwright page open yet. Use browser.navigate first, then browser.evaluate.",
            session: s,
          };
        }
        if (ev.code === "runtime") {
          const session = ev.transcription
            ? await mergeTranscription(spaceId, userId, ev.transcription, action)
            : await browserSession.appendAction(spaceId, action, userId);
          return {
            ok: false,
            message: "browser_evaluate_runtime_error",
            detail: ev.detail,
            implemented: true,
            userMessage: `Evaluate failed: ${ev.detail ?? "unknown error"}`,
            session,
          };
        }
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: `browser.evaluate_${ev.code}`,
          implemented: false,
          userMessage: `Evaluate not run (${ev.code}).`,
          session: s,
        };
      }
      const session = await mergeTranscription(spaceId, userId, ev.transcription, action);
      return {
        ok: true,
        message: "browser_evaluate_ok",
        implemented: true,
        userMessage: `Evaluate result (JSON):\n${ev.resultJson}\n\n(Page snapshot refreshed.)`,
        session,
      };
    }
    case "browser.scroll": {
      const raw = block.payload.amount;
      const amount =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : Number.NaN;
      if (!Number.isFinite(amount)) {
        const s = await browserSession.getSession(spaceId, userId);
        return {
          ok: false,
          message: "browser.scroll_missing_amount",
          implemented: false,
          userMessage: "browser.scroll requires a numeric payload.amount.",
          session: s,
        };
      }
      const action: BrowserAction = {
        id: uuid(),
        type: "scroll",
        amount,
        createdAt: new Date().toISOString(),
      };
      const newTx = await playwrightScrollRefresh(spaceId, userId, amount);
      if (newTx) {
        const session = await mergeTranscription(spaceId, userId, newTx, action);
        return {
          ok: true,
          message: "browser_scroll_done",
          implemented: true,
          userMessage: `Scrolled and refreshed the page snapshot.`,
          session,
        };
      }
      const session = await browserSession.appendAction(spaceId, action, userId);
      return {
        ok: true,
        message: "browser_scroll_logged",
        implemented: false,
        userMessage:
          "Scroll recorded. Enable AIRIS_PLAYWRIGHT=1 for live wheel scrolling and snapshot refresh.",
        session,
      };
    }
    default: {
      const s = await browserSession.getSession(spaceId, userId);
      return {
        ok: false,
        message: "browser.unhandled_type",
        implemented: false,
        userMessage: "Internal error: not a browser execution type.",
        session: s,
      };
    }
  }
}
