import { create } from "zustand";
import type { LayoutState, SpaceMeta, WidgetLoadWarning, WidgetRecord } from "@airis/shared";
import { defaultLayoutForKind } from "@airis/shared";
import type { SpaceBundle } from "../lib/api";
import { api } from "../lib/api";
import {
  CLI_CATALOG_MENU_FAMILIES,
  type CliCatalogMenuFamilyId,
} from "../features/widgets/cli-catalog-families";

type WorkspaceSettings = SpaceBundle["settings"];

interface WidgetsState {
  spaceId: string | null;
  space: SpaceMeta | null;
  settings: WorkspaceSettings | null;
  layout: LayoutState;
  widgets: WidgetRecord[];
  widgetLoadWarnings: WidgetLoadWarning[];
  loading: boolean;
  error: string | null;
  load: (spaceId: string) => Promise<void>;
  clear: () => void;
  addNoteWidget: () => Promise<void>;
  addSequencerPanelWidget: () => Promise<void>;
  addDrumMachinePanelWidget: () => Promise<void>;
  addPianoRollPanelWidget: () => Promise<void>;
  addChordProgressionPanelWidget: () => Promise<void>;
  addLoopRecorderPanelWidget: () => Promise<void>;
  addMetronomePanelWidget: () => Promise<void>;
  addSynthKeyboardPanelWidget: () => Promise<void>;
  addAudioVisualizerPanelWidget: () => Promise<void>;
  addMiniPlayerPanelWidget: () => Promise<void>;
  addKaraokeLyricPanelWidget: () => Promise<void>;
  addGuitarTunerPanelWidget: () => Promise<void>;
  addSnakeGamePanelWidget: () => Promise<void>;
  addTicTacToePanelWidget: () => Promise<void>;
  addMemoryMatchPanelWidget: () => Promise<void>;
  addPuzzle2048PanelWidget: () => Promise<void>;
  addWhackAMolePanelWidget: () => Promise<void>;
  addHangmanPanelWidget: () => Promise<void>;
  addRockPaperScissorsPanelWidget: () => Promise<void>;
  addConnectFourPanelWidget: () => Promise<void>;
  addMinesweeperPanelWidget: () => Promise<void>;
  addReactionTimePanelWidget: () => Promise<void>;
  addTypingSpeedPanelWidget: () => Promise<void>;
  addPongPanelWidget: () => Promise<void>;
  addAirisAgentWidget: () => Promise<void>;
  addCliCatalogWidget: (opts?: { familyId?: CliCatalogMenuFamilyId }) => Promise<void>;
  patchWidgetRecord: (widgetId: string, patch: Record<string, unknown>) => Promise<void>;
  deleteWidget: (widgetId: string) => Promise<void>;
}

export const useWidgetsStore = create<WidgetsState>((set, get) => ({
  spaceId: null,
  space: null,
  settings: null,
  layout: { widgets: [] },
  widgets: [],
  widgetLoadWarnings: [],
  loading: false,
  error: null,

  clear: () =>
    set({
      spaceId: null,
      space: null,
      settings: null,
      layout: { widgets: [] },
      widgets: [],
      widgetLoadWarnings: [],
      error: null,
    }),

  load: async (spaceId: string) => {
    set({ loading: true, error: null });
    try {
      const bundle = await api.getSpace(spaceId);
      set({
        spaceId,
        space: bundle.space,
        settings: bundle.settings,
        layout: bundle.layout,
        widgets: bundle.widgets,
        widgetLoadWarnings: bundle.widgetLoadWarnings,
        loading: false,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  addNoteWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, { kind: "note", title: "Note" });
    await get().load(sid);
  },

  addSequencerPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "sequencer-panel",
      title: "Step sequencer",
      layout: defaultLayoutForKind("sequencer-panel"),
    });
    await get().load(sid);
  },

  addDrumMachinePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "drum-machine-panel",
      title: "Drum machine",
      layout: defaultLayoutForKind("drum-machine-panel"),
    });
    await get().load(sid);
  },

  addPianoRollPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "piano-roll-panel",
      title: "Piano roll",
      layout: defaultLayoutForKind("piano-roll-panel"),
    });
    await get().load(sid);
  },

  addChordProgressionPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "chord-progression-panel",
      title: "Chord progression",
      layout: defaultLayoutForKind("chord-progression-panel"),
    });
    await get().load(sid);
  },

  addLoopRecorderPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "loop-recorder-panel",
      title: "Loop recorder",
      layout: defaultLayoutForKind("loop-recorder-panel"),
    });
    await get().load(sid);
  },

  addMetronomePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "metronome-panel",
      title: "Metronome",
      layout: defaultLayoutForKind("metronome-panel"),
    });
    await get().load(sid);
  },

  addSynthKeyboardPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "synth-keyboard-panel",
      title: "Synth keyboard",
      layout: defaultLayoutForKind("synth-keyboard-panel"),
    });
    await get().load(sid);
  },

  addAudioVisualizerPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "audio-visualizer-panel",
      title: "Audio visualizer",
      layout: defaultLayoutForKind("audio-visualizer-panel"),
    });
    await get().load(sid);
  },

  addMiniPlayerPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "mini-player-panel",
      title: "Mini player",
      layout: defaultLayoutForKind("mini-player-panel"),
    });
    await get().load(sid);
  },

  addKaraokeLyricPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "karaoke-lyric-panel",
      title: "Karaoke lyrics",
      layout: defaultLayoutForKind("karaoke-lyric-panel"),
    });
    await get().load(sid);
  },

  addGuitarTunerPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "guitar-tuner-panel",
      title: "Guitar tuner",
      layout: defaultLayoutForKind("guitar-tuner-panel"),
    });
    await get().load(sid);
  },

  addSnakeGamePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "snake-game-panel",
      title: "Snake",
      layout: defaultLayoutForKind("snake-game-panel"),
    });
    await get().load(sid);
  },

  addTicTacToePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "tic-tac-toe-panel",
      title: "Tic-Tac-Toe",
      layout: defaultLayoutForKind("tic-tac-toe-panel"),
    });
    await get().load(sid);
  },

  addMemoryMatchPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "memory-match-panel",
      title: "Memory Match",
      layout: defaultLayoutForKind("memory-match-panel"),
    });
    await get().load(sid);
  },

  addPuzzle2048PanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "puzzle-2048-panel",
      title: "2048",
      layout: defaultLayoutForKind("puzzle-2048-panel"),
    });
    await get().load(sid);
  },

  addWhackAMolePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "whack-a-mole-panel",
      title: "Whack-a-Mole",
      layout: defaultLayoutForKind("whack-a-mole-panel"),
    });
    await get().load(sid);
  },

  addHangmanPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "hangman-panel",
      title: "Hangman",
      layout: defaultLayoutForKind("hangman-panel"),
    });
    await get().load(sid);
  },

  addRockPaperScissorsPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "rock-paper-scissors-panel",
      title: "Rock Paper Scissors",
      layout: defaultLayoutForKind("rock-paper-scissors-panel"),
    });
    await get().load(sid);
  },

  addConnectFourPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "connect-four-panel",
      title: "Connect Four",
      layout: defaultLayoutForKind("connect-four-panel"),
    });
    await get().load(sid);
  },

  addMinesweeperPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "minesweeper-panel",
      title: "Minesweeper",
      layout: defaultLayoutForKind("minesweeper-panel"),
    });
    await get().load(sid);
  },

  addReactionTimePanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "reaction-time-panel",
      title: "Reaction time",
      layout: defaultLayoutForKind("reaction-time-panel"),
    });
    await get().load(sid);
  },

  addTypingSpeedPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "typing-speed-panel",
      title: "Typing speed",
      layout: defaultLayoutForKind("typing-speed-panel"),
    });
    await get().load(sid);
  },

  addPongPanelWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.createWidget(sid, {
      kind: "pong-panel",
      title: "Pong",
      layout: defaultLayoutForKind("pong-panel"),
    });
    await get().load(sid);
  },

  addAirisAgentWidget: async () => {
    const sid = get().spaceId;
    if (!sid) return;
    const existing = get().widgets.filter((w) => w.kind === "airis-agent").length;
    if (existing >= 5) {
      // TODO: Replace `window.alert` with the app toast system when a global toast API exists.
      window.alert("This workspace already has the maximum of 5 AIRIS agent widgets.");
      return;
    }
    const sessionId = crypto.randomUUID();
    await api.createWidget(sid, {
      kind: "airis-agent",
      title: "AIRIS agent",
      data: {
        sessionId,
        messages: [],
        agentStatus: "idle",
        spawnDepth: 0,
      },
      layout: defaultLayoutForKind("airis-agent"),
    });
    await get().load(sid);
  },

  addCliCatalogWidget: async (opts) => {
    const sid = get().spaceId;
    if (!sid) return;
    const fam =
      opts?.familyId != null
        ? CLI_CATALOG_MENU_FAMILIES.find((f) => f.id === opts.familyId)
        : undefined;
    await api.createWidget(sid, {
      kind: "cli-catalog",
      title: fam ? `CLI — ${fam.label}` : "CLI catalog",
      data: fam ? { recentRuns: [], cliFamilyId: fam.id } : { recentRuns: [] },
      layout: defaultLayoutForKind("cli-catalog"),
    });
    await get().load(sid);
  },

  patchWidgetRecord: async (widgetId: string, patch: Record<string, unknown>) => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.patchWidget(sid, widgetId, patch);
    await get().load(sid);
  },

  deleteWidget: async (widgetId: string) => {
    const sid = get().spaceId;
    if (!sid) return;
    await api.deleteWidget(sid, widgetId);
    await get().load(sid);
  },
}));
