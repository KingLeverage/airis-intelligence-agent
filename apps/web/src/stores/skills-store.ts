import { create } from "zustand";
import type { SpaceSkillConfig, SkillSummary } from "@airis/shared";
import { api } from "../lib/api";

interface SkillsState {
  config: SpaceSkillConfig | null;
  skills: SkillSummary[];
  loading: boolean;
  error: string | null;
  loadForSpace: (spaceId: string | null) => Promise<void>;
  enable: (spaceId: string, skillId: string) => Promise<void>;
  disable: (spaceId: string, skillId: string) => Promise<void>;
  setPinned: (spaceId: string, skillId: string, pinned: boolean) => Promise<void>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  config: null,
  skills: [],
  loading: false,
  error: null,

  loadForSpace: async (spaceId) => {
    if (!spaceId) {
      set({ config: null, skills: [], error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await api.getSpaceSkills(spaceId);
      set({ config: data.config, skills: data.skills, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  enable: async (spaceId, skillId) => {
    set({ error: null });
    try {
      const { config } = await api.enableSpaceSkill(spaceId, skillId);
      const enabledSet = new Set(config.enabledSkillIds);
      const pinnedSet = new Set(config.pinnedSkillIds ?? []);
      const skills = get().skills.map((s) => ({
        ...s,
        enabled: enabledSet.has(s.id),
        pinned: pinnedSet.has(s.id),
      }));
      set({ config, skills });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  disable: async (spaceId, skillId) => {
    set({ error: null });
    try {
      const { config } = await api.disableSpaceSkill(spaceId, skillId);
      const enabledSet = new Set(config.enabledSkillIds);
      const pinnedSet = new Set(config.pinnedSkillIds ?? []);
      const skills = get().skills.map((s) => ({
        ...s,
        enabled: enabledSet.has(s.id),
        pinned: pinnedSet.has(s.id),
      }));
      set({ config, skills });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  setPinned: async (spaceId, skillId, pinned) => {
    const cfg = get().config;
    if (!cfg) return;
    const pins = new Set(cfg.pinnedSkillIds ?? []);
    if (pinned) pins.add(skillId);
    else pins.delete(skillId);
    set({ error: null });
    try {
      const { config } = await api.putSpaceSkills(spaceId, {
        enabledSkillIds: cfg.enabledSkillIds,
        pinnedSkillIds: [...pins],
      });
      const enabledSet = new Set(config.enabledSkillIds);
      const pinnedSet = new Set(config.pinnedSkillIds ?? []);
      const skills = get().skills.map((s) => ({
        ...s,
        enabled: enabledSet.has(s.id),
        pinned: pinnedSet.has(s.id),
      }));
      set({ config, skills });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
