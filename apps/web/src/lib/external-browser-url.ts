/**
 * Workspace browser should track **remote** pages. The SPA’s own origin (e.g. airis.app,
 * localhost:5173) sometimes appears in `browserSession.currentUrl` by mistake — treating it as a
 * browse target overwrites the address bar while a native BrowserView still shows Google Maps.
 */
export function isExternalBrowserTarget(url: string): boolean {
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (typeof window === "undefined") return true;
  try {
    return new URL(t).origin !== window.location.origin;
  } catch {
    return false;
  }
}
