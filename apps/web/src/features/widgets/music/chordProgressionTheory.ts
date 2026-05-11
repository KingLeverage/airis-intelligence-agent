/** Catalog #3 — diatonic triads in major / natural minor (12 keys). */

export const CHORD_KEY_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type ChordProgressionMode = "major" | "natural_minor";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const MAJOR_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const;
const MINOR_ROMAN = ["i", "ii°", "III", "iv", "v", "VI", "VII"] as const;

type TriadQuality = "maj" | "min" | "dim";

const MAJOR_QUAL: TriadQuality[] = ["maj", "min", "min", "maj", "maj", "min", "dim"];
const MINOR_QUAL: TriadQuality[] = ["min", "dim", "maj", "min", "min", "maj", "maj"];

export type ChordSlot = {
  degree: number;
  roman: string;
  symbol: string;
  /** MIDI note numbers (middle register, triad). */
  midiNotes: [number, number, number];
  /** Tone.js note names e.g. C4 */
  toneNotes: [string, string, string];
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function midiToToneName(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${oct}`;
}

function triadIntervals(q: TriadQuality): [number, number] {
  if (q === "maj") return [4, 7];
  if (q === "min") return [3, 7];
  return [3, 6];
}

function symbolFor(rootSemitone: number, q: TriadQuality): string {
  const root = CHORD_KEY_NAMES[rootSemitone];
  if (q === "maj") return root;
  if (q === "min") return `${root}m`;
  return `${root}dim`;
}

function degreeRootSemitone(keyIndex: number, degree: number, mode: ChordProgressionMode): number {
  const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  return (keyIndex + scale[degree - 1]) % 12;
}

export function chordSlotForDegree(
  keyIndex: number,
  mode: ChordProgressionMode,
  degree: number,
  baseMidiRoot = 60,
): ChordSlot {
  const qual = mode === "major" ? MAJOR_QUAL[degree - 1] : MINOR_QUAL[degree - 1];
  const roman = mode === "major" ? MAJOR_ROMAN[degree - 1] : MINOR_ROMAN[degree - 1];
  const rs = degreeRootSemitone(keyIndex, degree, mode);
  const [i3, i5] = triadIntervals(qual);
  const r = baseMidiRoot + rs;
  const midiNotes: [number, number, number] = [r, r + i3, r + i5];
  return {
    degree,
    roman,
    symbol: symbolFor(rs, qual),
    midiNotes,
    toneNotes: [midiToToneName(midiNotes[0]), midiToToneName(midiNotes[1]), midiToToneName(midiNotes[2])],
  };
}

export function buildProgression(
  keyIndex: number,
  mode: ChordProgressionMode,
  degrees: readonly [number, number, number, number],
): ChordSlot[] {
  return degrees.map((d) => chordSlotForDegree(keyIndex, mode, d));
}

export const PRESETS_MAJOR: readonly (readonly [number, number, number, number])[] = [
  [1, 5, 6, 4],
  [1, 6, 4, 5],
  [6, 4, 1, 5],
  [2, 5, 1, 1],
  [1, 4, 6, 5],
  [3, 6, 2, 5],
  [1, 5, 4, 1],
  [4, 5, 6, 5],
];

export const PRESETS_MINOR: readonly (readonly [number, number, number, number])[] = [
  [1, 6, 7, 3],
  [1, 4, 6, 5],
  [6, 3, 7, 1],
  [2, 5, 1, 7],
  [1, 7, 6, 4],
  [3, 4, 5, 1],
];

export function randomPreset(mode: ChordProgressionMode): [number, number, number, number] {
  const list = mode === "major" ? PRESETS_MAJOR : PRESETS_MINOR;
  const pick = list[Math.floor(Math.random() * list.length)]!;
  return [pick[0], pick[1], pick[2], pick[3]];
}
