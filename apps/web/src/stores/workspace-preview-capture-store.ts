import { create } from "zustand";

type State = {
  root: HTMLElement | null;
  setCaptureRoot: (el: HTMLElement | null) => void;
  /** Incremented after grid drag/resize stops so thumbnails refresh quickly. */
  layoutInteractionTick: number;
  bumpPreviewAfterLayoutInteraction: () => void;
};

export const useWorkspacePreviewCaptureStore = create<State>((set) => ({
  root: null,
  setCaptureRoot: (el) => set({ root: el }),
  layoutInteractionTick: 0,
  bumpPreviewAfterLayoutInteraction: () =>
    set((s) => ({ layoutInteractionTick: s.layoutInteractionTick + 1 })),
}));
