/** Minimal MIDI type-0 file: one track, four triads × 1 quarter @ 480 PPQN, tempo 120. */

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16be(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function ascii(s: string): number[] {
  const o: number[] = [];
  for (let i = 0; i < s.length; i++) o.push(s.charCodeAt(i));
  return o;
}

/** Variable-length quantity (non-negative). */
export function vlq(n: number): number[] {
  if (n < 0) throw new Error("vlq negative");
  const b: number[] = [];
  b.unshift(n & 0x7f);
  let v = n >> 7;
  while (v > 0) {
    b.unshift(0x80 | (v & 0x7f));
    v >>= 7;
  }
  return b;
}

const PPQN = 480;

function buildTrack(chords: ReadonlyArray<readonly [number, number, number]>): number[] {
  const ev: number[] = [];
  /** Set tempo 120 BPM (500_000 µs per quarter). */
  ev.push(0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);

  for (const triad of chords) {
    let delta = 0;
    for (const note of triad) {
      ev.push(...vlq(delta), 0x90, note & 0x7f, 0x70);
      delta = 0;
    }
    delta = PPQN;
    for (const note of triad) {
      ev.push(...vlq(delta), 0x80, note & 0x7f, 0x00);
      delta = 0;
    }
  }
  ev.push(0, 0xff, 0x2f, 0x00);
  return ev;
}

export function encodeChordProgressionSmf(chords: ReadonlyArray<readonly [number, number, number]>): Uint8Array {
  const trk = buildTrack(chords);
  const header = [...ascii("MThd"), ...u32be(6), ...u16be(0), ...u16be(1), ...u16be(PPQN)];
  const chunk = [...ascii("MTrk"), ...u32be(trk.length), ...trk];
  return new Uint8Array([...header, ...chunk]);
}
