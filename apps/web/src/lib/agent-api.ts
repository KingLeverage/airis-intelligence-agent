import type { ChatMessage, WorkspaceSnapshot } from "@airis/shared";

const API = "";

export type StreamAgentParams = {
  sessionId: string;
  message: string;
  workspaceSnapshot: WorkspaceSnapshot;
  spawnDepth: number;
  conversationHistory: ChatMessage[];
};

export type StreamAgentHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (detail: string) => void;
};

type NdjsonEvent =
  | { type: "delta"; text?: string }
  | { type: "done" }
  | { type: "error"; detail?: string };

function isAbortError(e: unknown): boolean {
  if (!(e instanceof Error) && !(e instanceof DOMException)) return false;
  return (e as { name?: string }).name === "AbortError";
}

function parseNdjsonErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as {
      message?: string;
      error?: string;
      detail?: string;
    };
    return j.message ?? j.detail ?? j.error ?? text.slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
}

/**
 * POST `/api/agent/stream` with NDJSON body. Returns an `AbortController` immediately;
 * call `abort()` to cancel. Does not throw — failures are reported via `onError`.
 */
export function streamAgent(params: StreamAgentParams, handlers: StreamAgentHandlers): AbortController {
  const controller = new AbortController();

  void (async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const res = await fetch(`${API}/api/agent/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: params.sessionId,
          message: params.message,
          workspaceSnapshot: params.workspaceSnapshot,
          spawnDepth: params.spawnDepth,
          conversationHistory: params.conversationHistory,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        handlers.onError(parseNdjsonErrorBody(text));
        return;
      }

      reader = res.body?.getReader();
      if (!reader) {
        handlers.onError("No response body");
        return;
      }

      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: unknown;
          try {
            ev = JSON.parse(line) as NdjsonEvent;
          } catch {
            handlers.onError("Malformed NDJSON line from agent stream");
            return;
          }
          if (typeof ev !== "object" || !ev || !("type" in ev)) continue;
          const e = ev as NdjsonEvent;
          if (e.type === "delta" && typeof e.text === "string") {
            handlers.onDelta(e.text);
          } else if (e.type === "done") {
            handlers.onDone();
            return;
          } else if (e.type === "error") {
            handlers.onError(typeof e.detail === "string" ? e.detail : "stream_error");
            return;
          }
        }
      }

      handlers.onError("stream ended without done");
    } catch (e) {
      if (isAbortError(e)) {
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      handlers.onError(msg);
    } finally {
      reader?.releaseLock?.();
    }
  })();

  return controller;
}
