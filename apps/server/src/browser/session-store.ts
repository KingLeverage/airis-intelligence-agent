import { v4 as uuid } from "uuid";
import type { BrowserAction, BrowserPageTranscription, BrowserSession } from "@airis/shared";
import { BrowserSessionSchema } from "@airis/shared";
import { atomicWriteJson, readTextIfExists } from "../persistence/fs-utils.js";
import { browserSessionFile } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";

const cache = new Map<string, BrowserSession>();
const MAX_ACTIONS = 500;
const MAX_NAV_STACK = 32;

function cacheKey(spaceId: string, userId: string): string {
  return `${userId}:${spaceId}`;
}

export function createDefaultSession(spaceId: string): BrowserSession {
  return {
    id: uuid(),
    spaceId,
    navigationStack: [],
    actions: [],
  };
}

function coerceSession(raw: unknown, spaceId: string): BrowserSession {
  const fallback = createDefaultSession(spaceId);
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = BrowserSessionSchema.safeParse(raw);
  if (!parsed.success) return fallback;
  const s = parsed.data;
  return s.spaceId === spaceId ? s : { ...s, spaceId };
}

async function readFromDisk(spaceId: string, userId: string): Promise<BrowserSession> {
  const file = browserSessionFile(spaceId, userId);
  const text = await readTextIfExists(file);
  if (!text) return createDefaultSession(spaceId);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return createDefaultSession(spaceId);
  }
  return coerceSession(raw, spaceId);
}

export function invalidateBrowserSessionCache(spaceId: string, userId: string = DEFAULT_USER_ID): void {
  cache.delete(cacheKey(spaceId, userId));
}

export async function getSession(spaceId: string, userId: string = DEFAULT_USER_ID): Promise<BrowserSession> {
  const k = cacheKey(spaceId, userId);
  const hit = cache.get(k);
  if (hit) return hit;
  const s = await readFromDisk(spaceId, userId);
  cache.set(k, s);
  return s;
}

export async function writeSession(session: BrowserSession, userId: string = DEFAULT_USER_ID): Promise<void> {
  const k = cacheKey(session.spaceId, userId);
  const trimmed: BrowserSession = {
    ...session,
    actions: session.actions.slice(-MAX_ACTIONS),
  };
  cache.set(k, trimmed);
  await atomicWriteJson(browserSessionFile(session.spaceId, userId), trimmed);
}

function newActionId(): string {
  return uuid();
}

export async function applyNavigate(
  spaceId: string,
  url: string,
  transcription: BrowserPageTranscription,
  userId: string = DEFAULT_USER_ID,
  options?: { recordPriorUrl?: boolean },
): Promise<BrowserSession> {
  const s = await getSession(spaceId, userId);
  let stack = [...(s.navigationStack ?? [])];
  if (options?.recordPriorUrl && s.currentUrl && s.currentUrl !== url) {
    stack.push(s.currentUrl);
    if (stack.length > MAX_NAV_STACK) stack = stack.slice(-MAX_NAV_STACK);
  }
  const action: BrowserAction = {
    id: newActionId(),
    type: "navigate",
    url,
    createdAt: new Date().toISOString(),
  };
  const next: BrowserSession = {
    ...s,
    navigationStack: stack,
    currentUrl: url,
    lastTranscription: transcription,
    actions: [...s.actions, action].slice(-MAX_ACTIONS),
  };
  await writeSession(next, userId);
  return next;
}

export async function appendAction(
  spaceId: string,
  action: BrowserAction,
  userId: string = DEFAULT_USER_ID,
): Promise<BrowserSession> {
  const s = await getSession(spaceId, userId);
  const next: BrowserSession = {
    ...s,
    actions: [...s.actions, action].slice(-MAX_ACTIONS),
  };
  await writeSession(next, userId);
  return next;
}
