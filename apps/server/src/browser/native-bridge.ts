import { v4 as uuid } from "uuid";

export type NativeBridgeKind = "evaluate" | "extractText" | "extractHtml" | "scrollWheel";

/** Payload for OS-level `webContents.sendInputEvent` wheel synthesis (Electron desktop). */
export type NativeScrollWheelPayload = {
  x?: number;
  y?: number;
  deltaY?: number;
  steps?: number;
  stepDelayMs?: number;
};

/** Shape returned to the desktop renderer for each `/pending` poll item. */
export type PendingPollItem = {
  requestId: string;
  kind: NativeBridgeKind;
  expression?: string;
  timeoutMs?: number;
  payload?: NativeScrollWheelPayload;
};

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const outboundQueue: PendingPollItem[] = [];
const pendingById = new Map<string, PendingEntry>();

let bridgeAlive = false;
let lastPollAt = 0;

const HEARTBEAT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

export function applyStalePolicy(): void {
  if (lastPollAt > 0 && Date.now() - lastPollAt > HEARTBEAT_MS) {
    bridgeAlive = false;
  }
}

/** Mark the native bridge client as connected and refresh the heartbeat clock. */
export function registerNativeBridge(): void {
  bridgeAlive = true;
  lastPollAt = Date.now();
}

function removeQueued(requestId: string): void {
  const i = outboundQueue.findIndex((x) => x.requestId === requestId);
  if (i !== -1) outboundQueue.splice(i, 1);
}

/** Returns queued poll items and clears the outbound queue (each request delivered once). */
export function drainPending(): PendingPollItem[] {
  const out = [...outboundQueue];
  outboundQueue.length = 0;
  return out;
}

export function resolveNativeResult(requestId: string, result: unknown): void {
  const entry = pendingById.get(requestId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingById.delete(requestId);
  entry.resolve(result);
}

export function requestNativeAction(params: {
  kind: NativeBridgeKind;
  expression?: string;
  timeoutMs?: number;
  payload?: NativeScrollWheelPayload;
}): Promise<unknown> {
  applyStalePolicy();
  if (!bridgeAlive) {
    return Promise.reject(new Error("native_bridge_unavailable"));
  }
  const requestId = uuid();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pendingById.has(requestId)) return;
      pendingById.delete(requestId);
      removeQueued(requestId);
      reject(new Error("native_bridge_timeout"));
    }, REQUEST_TIMEOUT_MS);
    pendingById.set(requestId, { resolve, reject, timer });
    outboundQueue.push({
      requestId,
      kind: params.kind,
      ...(params.expression !== undefined ? { expression: params.expression } : {}),
      ...(params.timeoutMs !== undefined ? { timeoutMs: params.timeoutMs } : {}),
      ...(params.payload !== undefined ? { payload: params.payload } : {}),
    });
  });
}
