/**
 * Most public sites send `X-Frame-Options` / CSP `frame-ancestors` that forbid embedding
 * AIRIS (localhost or any other origin) in a cross-origin iframe — the panel then shows a
 * blank or broken page. We avoid that by **defaulting** to the same-origin server preview
 * (`/browser/preview`) for remote hosts.
 *
 * **Direct `iframe src` → real remote URL** is only used for loopback dev servers where
 * framing usually works and developers expect live JS/DOM.
 */
export function hostAllowsDirectRemoteIframe(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "[::1]") return true;
  return false;
}

export type PanelFrameMode = "live" | "preview_mirror";

export function resolvePanelFrameSrc(opts: {
  tabUrl: string;
  spaceId: string | null;
  apiBase: string;
  reloadNonce: number;
  splashSrc: string;
}): { src: string; mode: PanelFrameMode } {
  const { tabUrl, spaceId, apiBase, reloadNonce, splashSrc } = opts;
  const trimmed = tabUrl.trim();
  if (!trimmed) return { src: splashSrc, mode: "live" };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { src: splashSrc, mode: "live" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { src: splashSrc, mode: "live" };
  }

  const host = u.hostname.toLowerCase();
  if (!hostAllowsDirectRemoteIframe(host)) {
    if (!spaceId) return { src: splashSrc, mode: "preview_mirror" };
    const r = reloadNonce ? `&_r=${reloadNonce}` : "";
    return {
      src: `${apiBase}api/spaces/${spaceId}/browser/preview?url=${encodeURIComponent(trimmed)}${r}`,
      mode: "preview_mirror",
    };
  }

  return { src: trimmed, mode: "live" };
}
