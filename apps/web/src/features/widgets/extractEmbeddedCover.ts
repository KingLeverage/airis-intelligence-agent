/**
 * Reads embedded album art from local audio (MP3 ID3v2 APIC / PIC).
 * M4A/FLAC etc. are not parsed here — those stay on the gradient until we add parsers.
 */

const READ_BYTES = 512 * 1024;
/** Skip huge APIC blobs so widget JSON stays reasonable. */
const MAX_COVER_BYTES = 400 * 1024;

function readUInt32BE(u: Uint8Array, o: number): number {
  return ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
}

function readSyncsafeUint32(u: Uint8Array, o: number): number {
  return ((u[o] << 21) | (u[o + 1] << 14) | (u[o + 2] << 7) | u[o + 3]) >>> 0;
}

function ascii(u: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(u[start + i] ?? 0);
  return s;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

/** MIME from magic when ID3 MIME field is empty or generic. */
function sniffImageMime(pic: Uint8Array): string {
  if (pic.length >= 3 && pic[0] === 0xff && pic[1] === 0xd8 && pic[2] === 0xff) return "image/jpeg";
  if (pic.length >= 8 && pic[0] === 0x89 && pic[1] === 0x50 && pic[2] === 0x4e && pic[3] === 0x47) return "image/png";
  if (pic.length >= 6 && pic[0] === 0x47 && pic[1] === 0x49 && pic[2] === 0x46) return "image/gif";
  if (pic.length >= 12 && ascii(pic, 0, 4) === "RIFF" && ascii(pic, 8, 4) === "WEBP") return "image/webp";
  return "image/jpeg";
}

/**
 * Parse APIC (2.3/2.4) or PIC (2.2) frame body → raw image bytes + mime.
 */
function parseApicBody(data: Uint8Array): { mime: string; picture: Uint8Array } | null {
  if (data.length < 4) return null;
  const enc = data[0];
  let i = 1;

  const mimeStart = i;
  while (i < data.length && data[i] !== 0) i++;
  if (i >= data.length) return null;
  const mime = new TextDecoder("latin1").decode(data.subarray(mimeStart, i));
  i++;
  if (i >= data.length) return null;
  i++; // picture type

  if (enc === 0 || enc === 3) {
    while (i < data.length && data[i] !== 0) i++;
    if (i >= data.length) return null;
    i++;
  } else if (enc === 1 || enc === 2) {
    while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) i += 1;
    if (i + 1 >= data.length) return null;
    i += 2;
  } else {
    return null;
  }

  const picture = data.subarray(i);
  if (picture.length < 24) return null;
  const m = mime.trim() || sniffImageMime(picture);
  return { mime: m, picture };
}

function parsePicV22(data: Uint8Array): { mime: string; picture: Uint8Array } | null {
  if (data.length < 6) return null;
  const enc = data[0];
  const fmt = ascii(data, 1, 3).trim().toUpperCase();
  let mime = "image/jpeg";
  if (fmt === "PNG") mime = "image/png";
  else if (fmt === "JPG" || fmt === "JPEG") mime = "image/jpeg";
  let i = 5;
  if (i >= data.length) return null;
  i++; // picture type
  if (enc === 0) {
    while (i < data.length && data[i] !== 0) i++;
    if (i >= data.length) return null;
    i++;
  } else {
    while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) i += 2;
    if (i + 1 >= data.length) return null;
    i += 2;
  }
  const picture = data.subarray(i);
  if (picture.length < 24) return null;
  return { mime, picture };
}

function extractFromId3v2(u: Uint8Array): { mime: string; picture: Uint8Array } | null {
  if (u.length < 10 || u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return null;
  const major = u[3];
  const flags = u[5];
  const tagSize = readSyncsafeUint32(u, 6);
  let pos = 10;
  const tagEnd = Math.min(10 + tagSize, u.length);

  if (flags & 0x40 && (major === 3 || major === 4)) {
    if (major === 4) {
      if (pos + 4 > u.length) return null;
      const extSize = readSyncsafeUint32(u, pos);
      if (extSize < 4 || extSize > 1_000_000 || pos + extSize > u.length) return null;
      pos += extSize;
    } else {
      if (pos + 4 > u.length) return null;
      const extSize = readUInt32BE(u, pos);
      if (extSize < 6 || extSize > 1_000_000 || pos + extSize > u.length) return null;
      pos += extSize;
    }
  }

  if (major === 2) {
    while (pos + 6 <= tagEnd) {
      const id = ascii(u, pos, 3);
      const frameSize = (u[pos + 3] << 16) | (u[pos + 4] << 8) | u[pos + 5];
      pos += 6;
      if (frameSize < 0 || pos + frameSize > u.length) break;
      const body = u.subarray(pos, pos + frameSize);
      pos += frameSize;
      if (id === "PIC") {
        const r = parsePicV22(body);
        if (r) return r;
      }
    }
    return null;
  }

  if (major !== 3 && major !== 4) return null;

  while (pos + 10 <= tagEnd) {
    const id = ascii(u, pos, 4);
    const frameSize =
      major === 4 ? readSyncsafeUint32(u, pos + 4) : readUInt32BE(u, pos + 4);
    pos += 10;
    if (frameSize < 0 || pos + frameSize > u.length) break;
    const body = u.subarray(pos, pos + frameSize);
    pos += frameSize;
    if (id === "APIC") {
      const r = parseApicBody(body);
      if (r) return r;
    }
  }
  return null;
}

export type EmbeddedCover = { coverBase64: string; coverMime: string };

export async function extractEmbeddedCoverFromFile(file: File): Promise<EmbeddedCover | null> {
  const head = file.slice(0, Math.min(READ_BYTES, file.size));
  const buf = await head.arrayBuffer();
  const u = new Uint8Array(buf);
  const parsed = extractFromId3v2(u);
  if (!parsed) return null;
  if (parsed.picture.length > MAX_COVER_BYTES) return null;
  return {
    coverMime: parsed.mime,
    coverBase64: uint8ToBase64(parsed.picture),
  };
}
