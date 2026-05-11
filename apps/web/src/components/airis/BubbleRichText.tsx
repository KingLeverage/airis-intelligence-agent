import type { ReactNode } from "react";

const URL_CHUNK = /(\/api\/[^\s<]+|https?:\/\/[^\s<]+)/g;

function boldSegments(segment: string, baseKey: string): ReactNode[] {
  const parts = segment.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, j) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(p);
    if (m) {
      return (
        <strong key={`${baseKey}-b${j}`} className="font-semibold">
          {m[1]}
        </strong>
      );
    }
    return <span key={`${baseKey}-s${j}`}>{p}</span>;
  });
}

function lineToNodes(line: string, lineKey: number): ReactNode[] {
  const chunks = line.split(URL_CHUNK);
  const out: ReactNode[] = [];
  chunks.forEach((chunk, j) => {
    if (chunk === "") return;
    if (/^(\/api\/|https?:\/\/)/.test(chunk)) {
      out.push(
        <a
          key={`${lineKey}-a${j}`}
          href={chunk}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-600 underline decoration-sky-600/40 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          {chunk}
        </a>,
      );
    } else {
      out.push(...boldSegments(chunk, `${lineKey}-${j}`));
    }
  });
  return out;
}

/** `![alt](data:image/…|https://…)` — chat image models return large data URLs; render as `<img>`. */
const MARKDOWN_IMG = /!\[([^\]]*)\]\((data:image\/[a-z0-9.+-]+;base64,[^)]+|https?:\/\/[^)\s]+)\)/gi;

function lineNodesWithMarkdownImages(line: string, lineKey: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let imgIdx = 0;
  MARKDOWN_IMG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKDOWN_IMG.exec(line)) !== null) {
    const pre = line.slice(last, m.index);
    if (pre) nodes.push(...lineToNodes(pre, lineKey * 10_000 + imgIdx));
    const alt = (m[1]?.trim() || "Image").slice(0, 200);
    const src = m[2];
    nodes.push(
      <img
        key={`${lineKey}-img-${imgIdx++}`}
        src={src}
        alt={alt}
        className="my-2 max-h-[min(70vh,960px)] w-full max-w-full rounded-lg border border-slate-300/80 object-contain shadow-sm dark:border-slate-600/80"
      />,
    );
    last = m.index + m[0].length;
  }
  const tail = line.slice(last);
  if (tail) nodes.push(...lineToNodes(tail, lineKey * 10_000 + imgIdx));
  return nodes;
}

/** Minimal inline formatting: `**bold**`, newlines, markdown images; safe (no arbitrary HTML). */
export function BubbleRichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {lineNodesWithMarkdownImages(line, i)}
        </span>
      ))}
    </div>
  );
}
