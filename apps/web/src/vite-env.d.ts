/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public GitHub repo root for Start Fast links, e.g. https://github.com/org/airis-intelligence-agent */
  readonly VITE_AIRIS_REPO_URL?: string;
  /** Optional Discord invite URL; if unset, “Discord Community” uses GitHub Discussions. */
  readonly VITE_AIRIS_DISCORD_INVITE?: string;
  /** Optional YouTube channel, playlist, or demo video for “YouTube Demos”. */
  readonly VITE_AIRIS_YOUTUBE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by `apps/desktop/preload.cjs` when running under Electron. */
interface Window {
  airisNativeShell?: {
    readonly isElectron: true;
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<unknown>;
    loadURL: (url: string) => Promise<unknown>;
    goBack: () => Promise<unknown>;
    reload: () => Promise<unknown>;
    getCurrentUrl?: () => Promise<string>;
    onNavigated: (cb: (url: string) => void) => () => void;
    onRequestBoundsRefresh: (cb: () => void) => () => void;
  };
}
