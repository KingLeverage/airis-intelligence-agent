import type { FastifyBaseLogger } from "fastify";
import { registerNativeBridge, requestNativeAction } from "./native-bridge.js";

export type NativeBrowserProbeLog = Pick<FastifyBaseLogger, "info" | "warn">;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

function evalResult(res: unknown): unknown {
  if (!isRecord(res) || res.ok !== true) return undefined;
  return res.result;
}

/**
 * Marks the native bridge alive, waits briefly for the desktop poll loop, then verifies that
 * BrowserView-backed `evaluate` works (expression must be a valid JS expression, not a `return` statement).
 */
export async function probeNativeBrowserViewReady(log?: NativeBrowserProbeLog): Promise<boolean> {
  registerNativeBridge();
  await new Promise((r) => setTimeout(r, 450));
  try {
    const r = await requestNativeAction({
      kind: "evaluate",
      expression: "1",
      timeoutMs: 4000,
    });
    const ok1 = isRecord(r) && r.ok === true;
    log?.info({ stage: "probe-1", ok: ok1, value: evalResult(r) }, "native-browser.probe");
    if (!ok1) return false;

    const r2 = await requestNativeAction({
      kind: "evaluate",
      expression: "document.readyState",
      timeoutMs: 4000,
    });
    const val = evalResult(r2);
    const ok2 = isRecord(r2) && r2.ok === true;
    log?.info({ stage: "probe-2", ok: ok2, value: val }, "native-browser.probe");

    if (!ok2) {
      log?.warn({ stage: "probe-2", ok: false, value: val, note: "evaluate_failed" }, "native-browser.probe");
      return true;
    }
    if (val == null) {
      log?.warn({ stage: "probe-2", ok: true, value: val, note: "readyState_uninitialized" }, "native-browser.probe");
      return true;
    }
    if (typeof val === "string") {
      const v = val.trim();
      if (v !== "complete" && v !== "interactive" && v !== "loading") {
        log?.warn({ stage: "probe-2", ok: true, value: val, note: "readyState_unexpected" }, "native-browser.probe");
      }
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log?.warn({ stage: "probe-1", ok: false, value: msg }, "native-browser.probe");
    return false;
  }
}
