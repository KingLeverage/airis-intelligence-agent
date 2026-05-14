import { useEffect } from "react";

type PendingItem = {
  requestId: string;
  kind: "evaluate" | "extractText" | "extractHtml" | "scrollWheel";
  expression?: string;
  timeoutMs?: number;
  payload?: Record<string, unknown>;
};

function isPendingItem(v: unknown): v is PendingItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.requestId !== "string") return false;
  const k = o.kind;
  return (
    k === "evaluate" ||
    k === "extractText" ||
    k === "extractHtml" ||
    k === "scrollWheel"
  );
}

/**
 * When the desktop Electron shell is active, polls the API for native BrowserView work
 * queued by the server and runs it via `window.airisNativeShell`.
 */
export function NativeBrowserBridge(): null {
  useEffect(() => {
    const shell = window.airisNativeShell;
    if (!shell?.isElectron) return;
    const evaluate = shell.evaluate;
    const extractText = shell.extractText;
    const extractHtml = shell.extractHtml;
    const scrollWheel = shell.scrollWheel;
    if (
      typeof evaluate !== "function" ||
      typeof extractText !== "function" ||
      typeof extractHtml !== "function"
    ) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        await fetch("/api/native-browser/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        /* keep polling */
      }

      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/native-browser/pending");
          if (!res.ok) return;
          const json: unknown = await res.json();
          const pendingRaw =
            json && typeof json === "object" && "pending" in json && Array.isArray((json as { pending: unknown }).pending)
              ? (json as { pending: unknown[] }).pending
              : [];
          for (const raw of pendingRaw) {
            if (!isPendingItem(raw)) continue;
            let result: unknown;
            try {
              switch (raw.kind) {
                case "evaluate":
                  result = await evaluate(raw.expression ?? "", raw.timeoutMs);
                  break;
                case "extractText":
                  result = await extractText();
                  break;
                case "extractHtml":
                  result = await extractHtml();
                  break;
                case "scrollWheel":
                  if (typeof scrollWheel !== "function") {
                    result = { ok: false, error: "scrollWheel_unsupported" };
                  } else {
                    result = await scrollWheel(raw.payload ?? {});
                  }
                  break;
              }
            } catch (e) {
              result = { ok: false, error: String(e instanceof Error ? e.message : e) };
            }
            try {
              await fetch(`/api/native-browser/result/${encodeURIComponent(raw.requestId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ result }),
              });
            } catch {
              /* next poll will continue */
            }
          }
        } catch {
          /* single failed poll must not stop the loop */
        }
      }, 400);
    })();

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return null;
}
