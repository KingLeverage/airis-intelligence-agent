import { createRequire } from "node:module";

const MAX = 200_000;

/**
 * Best-effort PDF text for indexing (no OCR). Uses `pdf-parse` (CommonJS).
 */
export async function extractPdfText(buffer: Buffer): Promise<string | undefined> {
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text?: string }>;
    const data = await pdfParse(buffer);
    const raw = (data.text ?? "").replace(/\s+/g, " ").trim();
    if (!raw) return undefined;
    return raw.length > MAX ? raw.slice(0, MAX) : raw;
  } catch {
    return undefined;
  }
}
