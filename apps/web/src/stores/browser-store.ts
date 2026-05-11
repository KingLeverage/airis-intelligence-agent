import { create } from "zustand";
import type { BrowserSession } from "@airis/shared";
import { api } from "../lib/api";

type BrowserActionArg =
  | { type: "click"; targetId: string }
  | { type: "type"; targetId: string; text: string }
  | { type: "scroll"; amount: number }
  | { type: "back" };

interface BrowserWorkspaceState {
  session: BrowserSession | null;
  loading: boolean;
  error: string | null;
  lastStubMessage: string | null;
  clear: () => void;
  /** Sync from chat/execution API without a round-trip GET. */
  setSessionFromServer: (session: BrowserSession | null) => void;
  loadSession: (spaceId: string) => Promise<void>;
  navigate: (spaceId: string, url: string, mode?: "mock" | "fetch" | "visual") => Promise<void>;
  postAction: (spaceId: string, action: BrowserActionArg) => Promise<{ implemented: boolean; message: string } | null>;
}

export const useBrowserStore = create<BrowserWorkspaceState>((set) => ({
  session: null,
  loading: false,
  error: null,
  lastStubMessage: null,

  clear: () => set({ session: null, error: null, lastStubMessage: null }),

  setSessionFromServer: (session: BrowserSession | null) => {
    if (session) {
      set({ session, error: null });
    }
  },

  loadSession: async (spaceId: string) => {
    set({ loading: true, error: null });
    try {
      const { session } = await api.getBrowserSession(spaceId);
      set({ session, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  navigate: async (spaceId: string, url: string, mode?: "mock" | "fetch" | "visual") => {
    set({ loading: true, error: null, lastStubMessage: null });
    try {
      const r = await api.navigateBrowser(spaceId, url, mode);
      set({
        session: r.session,
        loading: false,
        lastStubMessage: r.result.implemented ? null : r.result.message,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  postAction: async (spaceId: string, action: BrowserActionArg) => {
    set({ loading: true, error: null });
    try {
      const r = await api.postBrowserAction(spaceId, action);
      set({
        session: r.session,
        loading: false,
        lastStubMessage: r.result.message,
      });
      return r.result;
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },
}));
