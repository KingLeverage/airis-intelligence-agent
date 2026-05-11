/**
 * Electron desktop shell (`apps/desktop`) exposes a native Chromium `BrowserView` over the
 * workspace browser area. When present, `BrowserPanel` skips the iframe preview path.
 */

export type NativeBrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AirisNativeShell = {
  readonly isElectron: true;
  setBounds(bounds: NativeBrowserBounds): Promise<unknown>;
  loadURL(url: string): Promise<unknown>;
  goBack(): Promise<unknown>;
  reload(): Promise<unknown>;
  /** Top URL of the embedded BrowserView (for reconciling the address bar). */
  getCurrentUrl?: () => Promise<string>;
  onNavigated(cb: (url: string) => void): () => void;
  onRequestBoundsRefresh(cb: () => void): () => void;
};

export function getAirisNativeShell(): AirisNativeShell | null {
  if (typeof window === "undefined") return null;
  const shell = (window as unknown as { airisNativeShell?: Partial<AirisNativeShell> }).airisNativeShell;
  if (shell && shell.isElectron === true && typeof shell.setBounds === "function") {
    return shell as AirisNativeShell;
  }
  return null;
}
