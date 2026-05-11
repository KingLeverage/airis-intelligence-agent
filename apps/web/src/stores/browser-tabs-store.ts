import { create } from "zustand";

export type BrowserTab = {
  id: string;
  /** Last committed URL for this tab’s iframe; empty = splash home. */
  url: string;
  title: string;
  /** Address bar value while editing. */
  draft: string;
};

function newTabId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function freshTab(): BrowserTab {
  return { id: newTabId(), url: "", title: "New tab", draft: "" };
}

interface BrowserTabsState {
  ownerSpaceId: string | null;
  tabs: BrowserTab[];
  activeTabId: string | null;
  ensureForSpace: (spaceId: string) => void;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;
  setActiveTabUrl: (url: string, title?: string) => void;
  updateActiveDraft: (draft: string) => void;
}

export const useBrowserTabsStore = create<BrowserTabsState>((set, get) => ({
  ownerSpaceId: null,
  tabs: [freshTab()],
  activeTabId: null,

  ensureForSpace: (spaceId) => {
    const cur = get().ownerSpaceId;
    if (cur === spaceId) {
      if (!get().activeTabId) {
        const first = get().tabs[0];
        if (first) set({ activeTabId: first.id });
      }
      return;
    }
    const t = freshTab();
    set({ ownerSpaceId: spaceId, tabs: [t], activeTabId: t.id });
  },

  addTab: () => {
    const t = freshTab();
    set((s) => ({ tabs: [...s.tabs, t], activeTabId: t.id }));
  },

  closeTab: (tabId) => {
    set((s) => {
      const nextTabs = s.tabs.filter((x) => x.id !== tabId);
      if (nextTabs.length === 0) {
        const nt = freshTab();
        return { tabs: [nt], activeTabId: nt.id };
      }
      const nextActive =
        s.activeTabId === tabId ? nextTabs[nextTabs.length - 1]!.id : s.activeTabId;
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  },

  selectTab: (tabId) => set({ activeTabId: tabId }),

  setActiveTabUrl: (url, title) => {
    set((s) => {
      let id = s.activeTabId;
      if (!id) {
        const first = s.tabs[0];
        if (!first) return s;
        id = first.id;
      }
      const nextTitle = title ?? s.tabs.find((x) => x.id === id)?.title ?? "Tab";
      return {
        activeTabId: id,
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, url, title: nextTitle, draft: url || t.draft } : t,
        ),
      };
    });
  },

  updateActiveDraft: (draft) => {
    set((s) => {
      let id = s.activeTabId;
      if (!id) {
        const first = s.tabs[0];
        if (!first) return s;
        id = first.id;
      }
      return {
        activeTabId: id,
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, draft } : t)),
      };
    });
  },
}));
