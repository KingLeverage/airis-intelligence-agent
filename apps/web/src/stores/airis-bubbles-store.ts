import { create } from "zustand";

export type AirisBubbleKind =
  | "reply"
  | "action"
  | "success"
  | "warning"
  | "error"
  | "thinking";

export type AirisBubble = {
  id: string;
  kind: AirisBubbleKind;
  text: string;
  createdAt: number;
};

const THINKING_ID = "airis-bubble-thinking";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

interface BubblesState {
  bubbles: AirisBubble[];
  pushBubble: (b: Omit<AirisBubble, "id" | "createdAt"> & { id?: string }) => void;
  removeBubble: (id: string) => void;
  setThinking: (active: boolean) => void;
  clearBubbles: () => void;
}

const MAX_BUBBLES = 12;

export const useAirisBubblesStore = create<BubblesState>((set, get) => ({
  bubbles: [],

  pushBubble: (b) => {
    const bubble: AirisBubble = {
      id: b.id ?? newId(),
      kind: b.kind,
      text: b.text,
      createdAt: Date.now(),
    };
    set((s) => {
      const next = [...s.bubbles.filter((x) => x.id !== bubble.id), bubble];
      next.sort((a, b) => a.createdAt - b.createdAt);
      return { bubbles: next.slice(-MAX_BUBBLES) };
    });
  },

  removeBubble: (id) => set((s) => ({ bubbles: s.bubbles.filter((x) => x.id !== id) })),

  setThinking: (active) => {
    if (active) {
      get().pushBubble({ id: THINKING_ID, kind: "thinking", text: "Working…" });
    } else {
      get().removeBubble(THINKING_ID);
    }
  },

  clearBubbles: () => set({ bubbles: [] }),
}));
