/// <reference lib="dom" />
import type { BrowserPageTranscription } from "@airis/shared";
import * as browserSessionStore from "./session-store.js";
import { INTERACTIVE_SELECTOR_GROUPS, isTranscribeUrlBlocked, transcribeHtml } from "./transcribe.js";

type Slot = {
  browser: import("playwright").Browser;
  context: import("playwright").BrowserContext;
  page: import("playwright").Page;
};

const slots = new Map<string, Slot>();

/** Set `AIRIS_PLAYWRIGHT=1` and run `npx playwright install chromium` to enable real DOM automation. */
export function isPlaywrightBrowserEnabled(): boolean {
  return process.env.AIRIS_PLAYWRIGHT === "1";
}

/**
 * Solo / lab only: allow `browser.evaluate` to run model-supplied script inside the **headless**
 * Playwright page (not the AIRIS React app). Still powerful (network, `localhost`, etc.) — never
 * enable on a shared or internet-exposed server without understanding the risk.
 */
export function isPersonalBrowserEvalEnabled(): boolean {
  return process.env.AIRIS_PERSONAL_BROWSER_EVAL === "1";
}

const MAX_EVAL_SCRIPT_CHARS = 24_000;
const EVAL_TIMEOUT_MS = 25_000;

function safeJsonPreview(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(
      value,
      (_k, v) => (typeof v === "bigint" ? String(v) : v),
      2,
    );
    return s.length > maxChars ? `${s.slice(0, maxChars)}\n…(truncated)` : s;
  } catch {
    const s = String(value);
    return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
  }
}

export type PlaywrightEvaluateRefreshResult =
  | { ok: true; transcription: BrowserPageTranscription; resultJson: string }
  | {
      ok: false;
      code: "disabled" | "empty" | "too_long" | "no_page" | "runtime";
      detail?: string;
      transcription?: BrowserPageTranscription | null;
    };

/** Run async script body in page context (personal mode + Playwright only), then refresh snapshot. */
export async function playwrightEvaluateRefresh(
  spaceId: string,
  userId: string,
  script: string,
): Promise<PlaywrightEvaluateRefreshResult> {
  if (!isPlaywrightBrowserEnabled() || !isPersonalBrowserEvalEnabled()) {
    return { ok: false, code: "disabled" };
  }
  const trimmed = script.trim();
  if (!trimmed) return { ok: false, code: "empty" };
  if (trimmed.length > MAX_EVAL_SCRIPT_CHARS) {
    return { ok: false, code: "too_long", detail: String(MAX_EVAL_SCRIPT_CHARS) };
  }
  const slot = await ensureSlot(spaceId, userId);
  if (!slot) return { ok: false, code: "no_page" };
  try {
    const result = await Promise.race([
      slot.page.evaluate(
        async ({ code }: { code: string }) => {
          const AsyncFunction = Object.getPrototypeOf(async function () {
            return undefined;
          }).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
          return await new AsyncFunction(`\n${code}\n`)();
        },
        { code: trimmed },
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Evaluate exceeded ${EVAL_TIMEOUT_MS}ms`)), EVAL_TIMEOUT_MS);
      }),
    ]);
    const transcription = await snapshotFromPage(slot.page);
    return {
      ok: true,
      transcription,
      resultJson: safeJsonPreview(result, 14_000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let transcription: BrowserPageTranscription | null = null;
    try {
      transcription = await snapshotFromPage(slot.page);
    } catch {
      /* ignore */
    }
    return { ok: false, code: "runtime", detail: msg.slice(0, 800), transcription };
  }
}

export async function closePlaywrightForSpace(spaceId: string): Promise<void> {
  const s = slots.get(spaceId);
  if (!s) return;
  slots.delete(spaceId);
  try {
    await s.context.close();
  } catch {
    /* ignore */
  }
  try {
    await s.browser.close();
  } catch {
    /* ignore */
  }
}

async function getSlot(spaceId: string): Promise<Slot | null> {
  if (!isPlaywrightBrowserEnabled()) return null;
  const hit = slots.get(spaceId);
  if (hit) return hit;
  try {
    const pw = await import("playwright");
    const browser = await pw.chromium.launch({ headless: true });
    // Omit custom userAgent so Chromium’s default Chrome-like UA is used. A bespoke
    // "…playwright" string is a strong bot signal and many sites (e.g. Yelp) return
    // empty shells or minimal DOM — then browser.evaluate legitimately returns [] / "".
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        configurable: true,
        get: () => undefined,
      });
    });
    const page = await context.newPage();
    const slot = { browser, context, page };
    slots.set(spaceId, slot);
    return slot;
  } catch (e) {
    console.warn("[playwright] launch failed — install browsers with: npx playwright install chromium", e);
    return null;
  }
}

export async function injectAirisElementIds(page: import("playwright").Page): Promise<void> {
  const groups = [...INTERACTIVE_SELECTOR_GROUPS];
  await page.evaluate((sels: string[]) => {
    const ATTR = "data-airis-id";
    const CAP = 80;
    let n = 0;
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el: Element) => {
        if (n >= CAP) return;
        if (el.closest("script, style, noscript")) return;
        el.setAttribute(ATTR, `e${n++}`);
      });
      if (n >= CAP) break;
    }
  }, groups);
}

async function snapshotFromPage(page: import("playwright").Page): Promise<BrowserPageTranscription> {
  await injectAirisElementIds(page);
  const html = await page.content();
  return transcribeHtml(html, page.url());
}

/** Open or reuse Playwright for this space; if no tab yet, load `currentUrl` from persisted session. */
async function ensureSlot(spaceId: string, userId: string): Promise<Slot | null> {
  const hit = slots.get(spaceId);
  if (hit) return hit;
  const s = await browserSessionStore.getSession(spaceId, userId);
  const url = s.currentUrl ?? s.lastTranscription?.url;
  if (!url || isTranscribeUrlBlocked(url)) return null;
  const tx = await playwrightGotoUrl(spaceId, url);
  return tx ? (slots.get(spaceId) ?? null) : null;
}

/** Latest viewport screenshot for the in-app “live” panel (requires an open Playwright page for this space). */
export async function playwrightScreenshotPng(spaceId: string): Promise<Buffer | null> {
  if (!isPlaywrightBrowserEnabled()) return null;
  const slot = slots.get(spaceId);
  if (!slot) return null;
  try {
    return await slot.page.screenshot({ type: "png", fullPage: false });
  } catch {
    return null;
  }
}

export async function playwrightGotoUrl(
  spaceId: string,
  url: string,
): Promise<BrowserPageTranscription | null> {
  if (!isPlaywrightBrowserEnabled() || isTranscribeUrlBlocked(url)) return null;
  const slot = await getSlot(spaceId);
  if (!slot) return null;
  try {
    await slot.page.goto(url, { waitUntil: "load", timeout: 45_000 });
    // SPAs (directories, maps) often mount listings after "load"; wait for quiescence then a short paint window.
    await slot.page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
    await new Promise<void>((r) => {
      setTimeout(r, 1200);
    });
    return await snapshotFromPage(slot.page);
  } catch (e) {
    console.warn("[playwright] goto error", e);
    await closePlaywrightForSpace(spaceId);
    return null;
  }
}

export async function playwrightClickRefresh(
  spaceId: string,
  userId: string,
  targetId: string,
): Promise<BrowserPageTranscription | null> {
  if (!isPlaywrightBrowserEnabled()) return null;
  const slot = await ensureSlot(spaceId, userId);
  if (!slot) return null;
  if (!/^e\d+$/i.test(targetId)) return null;
  try {
    const pre = await snapshotFromPage(slot.page);
    if (!pre.interactiveElements.some((e) => e.id === targetId)) {
      console.warn(`[playwright] target ${targetId} not in live DOM after load`);
      return null;
    }
    await slot.page.click(`[data-airis-id="${targetId}"]`, { timeout: 12_000 });
    await slot.page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    return await snapshotFromPage(slot.page);
  } catch (e) {
    console.warn("[playwright] click error", e);
    return null;
  }
}

export async function playwrightTypeRefresh(
  spaceId: string,
  userId: string,
  targetId: string,
  text: string,
): Promise<BrowserPageTranscription | null> {
  if (!isPlaywrightBrowserEnabled()) return null;
  const slot = await ensureSlot(spaceId, userId);
  if (!slot) return null;
  if (!/^e\d+$/i.test(targetId)) return null;
  try {
    const pre = await snapshotFromPage(slot.page);
    if (!pre.interactiveElements.some((e) => e.id === targetId)) {
      console.warn(`[playwright] type target ${targetId} not in live DOM`);
      return null;
    }
    await slot.page.fill(`[data-airis-id="${targetId}"]`, text, { timeout: 12_000 });
    return await snapshotFromPage(slot.page);
  } catch (e) {
    console.warn("[playwright] fill error", e);
    return null;
  }
}

export async function playwrightScrollRefresh(
  spaceId: string,
  userId: string,
  amount: number,
): Promise<BrowserPageTranscription | null> {
  if (!isPlaywrightBrowserEnabled()) return null;
  const slot = await ensureSlot(spaceId, userId);
  if (!slot) return null;
  try {
    await slot.page.mouse.wheel(0, amount);
    await new Promise((r) => setTimeout(r, 200));
    return await snapshotFromPage(slot.page);
  } catch (e) {
    console.warn("[playwright] scroll error", e);
    return null;
  }
}

void process.on("beforeExit", async () => {
  const ids = [...slots.keys()];
  for (const id of ids) {
    await closePlaywrightForSpace(id);
  }
});
