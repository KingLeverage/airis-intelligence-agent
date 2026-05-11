import { create } from "zustand";
import type { SpaceMeta } from "@airis/shared";
import { api } from "../lib/api";
import { runSpacePreviewFlush } from "../lib/space-preview-flush";
import { useAirisBubblesStore } from "./airis-bubbles-store";
import { useChromeStore } from "./chrome-store";
import { useWidgetsStore } from "./widgets-store";

/** Persisted workspace used for chat from Home without opening a space in the UI. */
export const HOME_CHAT_SPACE_LS_KEY = "airis.homeChatSpaceId";

interface SpacesState {
  spaces: SpaceMeta[];
  activeSpaceId: string | null;
  loading: boolean;
  error: string | null;
  loadSpaces: () => Promise<void>;
  createSpace: (name: string) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  selectSpace: (id: string) => Promise<void>;
  /** Open from home; clones demo spaces when `cloneOnOpen` is set. */
  openSpaceFromHome: (id: string) => Promise<void>;
  /** Leave active space and return to home (no auto-select). */
  exitToHome: () => Promise<void>;
  /** Valid persisted home-chat space id, or null (does not create). */
  getHomeChatSpaceIdIfValid: () => string | null;
  /** Create or reuse a non-demo space for API chat while Home shell stays visible (does not set activeSpaceId). */
  getOrCreateHomeChatSpaceId: () => Promise<string>;
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: [],
  activeSpaceId: null,
  loading: false,
  error: null,

  loadSpaces: async () => {
    set({ loading: true, error: null });
    try {
      const { spaces } = await api.listSpaces();
      const cur = get().activeSpaceId;
      const activeStill = cur ? spaces.some((s) => s.id === cur) : false;
      if (cur && !activeStill) {
        useWidgetsStore.getState().clear();
      }
      set({
        spaces,
        loading: false,
        activeSpaceId: activeStill ? cur : null,
      });
      if (activeStill && cur) {
        const { useSessionStore } = await import("./session-store");
        await useSessionStore.getState().refreshSpace();
      }
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  createSpace: async (name: string) => {
    set({ error: null });
    try {
      const { space } = await api.createSpace(name);
      await get().loadSpaces();
      await get().selectSpace(space.id);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  deleteSpace: async (id: string) => {
    await api.deleteSpace(id);
    try {
      const h = localStorage.getItem(HOME_CHAT_SPACE_LS_KEY);
      if (h === id) localStorage.removeItem(HOME_CHAT_SPACE_LS_KEY);
    } catch {
      /* ignore */
    }
    const cur = get().activeSpaceId;
    set({
      spaces: get().spaces.filter((s) => s.id !== id),
      activeSpaceId: cur === id ? null : cur,
    });
    if (cur === id) {
      useWidgetsStore.getState().clear();
    }
    await get().loadSpaces();
  },

  selectSpace: async (id: string) => {
    set({ activeSpaceId: id, error: null });
    const { useSessionStore } = await import("./session-store");
    await useSessionStore.getState().refreshSpace();
  },

  openSpaceFromHome: async (id: string) => {
    set({ error: null });
    const meta = get().spaces.find((s) => s.id === id);
    if (!meta) return;
    try {
      if (meta.demo && meta.cloneOnOpen) {
        const { space } = await api.cloneSpace(id);
        await get().loadSpaces();
        await get().selectSpace(space.id);
      } else {
        await get().selectSpace(id);
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  exitToHome: async () => {
    await runSpacePreviewFlush();
    set({ activeSpaceId: null, error: null });
    useWidgetsStore.getState().clear();
    const { useSessionStore } = await import("./session-store");
    useSessionStore.getState().clearHomeSession();
    const { useSkillsStore } = await import("./skills-store");
    await useSkillsStore.getState().loadForSpace(null);
    useChromeStore.getState().setAirisExpanded(false);
    useAirisBubblesStore.getState().clearBubbles();
    useChromeStore.getState().setOpenPanel(null);
    useChromeStore.getState().hydrateOrbForSpace(null);
  },

  getHomeChatSpaceIdIfValid: () => {
    try {
      const raw = localStorage.getItem(HOME_CHAT_SPACE_LS_KEY);
      if (!raw) return null;
      return get().spaces.some((s) => s.id === raw) ? raw : null;
    } catch {
      return null;
    }
  },

  getOrCreateHomeChatSpaceId: async () => {
    if (!get().spaces.length) {
      await get().loadSpaces();
    }

    const existingLs = get().getHomeChatSpaceIdIfValid();
    if (existingLs) return existingLs;

    try {
      localStorage.removeItem(HOME_CHAT_SPACE_LS_KEY);
    } catch {
      /* ignore */
    }

    set({ error: null });
    try {
      const { space } = await api.createSpace("Home chat");
      try {
        localStorage.setItem(HOME_CHAT_SPACE_LS_KEY, space.id);
      } catch {
        /* ignore */
      }
      await get().loadSpaces();
      return space.id;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },
}));
