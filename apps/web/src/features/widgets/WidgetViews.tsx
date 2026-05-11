import { useEffect, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

function sanitizeHtml(html: string): string {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export function NoteWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const initial = typeof record.data.content === "string" ? record.data.content : "";
  const [text, setText] = useState(initial);

  useEffect(() => {
    setText(typeof record.data.content === "string" ? record.data.content : "");
  }, [record.id, record.data.content]);

  return (
    <textarea
      className="min-h-[120px] w-full resize-y rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 text-sm text-slate-200 outline-none focus:border-cyan-700/50"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const cur = typeof record.data.content === "string" ? record.data.content : "";
        if (text === cur) return;
        void patchWidgetRecord(record.id, { data: { content: text } });
      }}
      placeholder="Write a note…"
    />
  );
}

export function HtmlCardWidgetView({ record }: { record: WidgetRecord }) {
  const html = typeof record.data.html === "string" ? record.data.html : "";
  const plain = typeof record.data.plain === "string" ? record.data.plain : "";
  if (!html && plain) {
    return <p className="text-sm text-slate-300">{plain}</p>;
  }
  return (
    <div
      className="max-w-none text-sm leading-relaxed text-slate-200 [&_a]:text-cyan-400"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) || "<p>(empty)</p>" }}
    />
  );
}

type CheckItem = { id: string; label: string; done: boolean };

export function ChecklistWidgetView({ record }: { record: WidgetRecord }) {
  const items = (Array.isArray(record.data.items) ? record.data.items : []) as CheckItem[];
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 text-cyan-400">{it.done ? "☑" : "☐"}</span>
          <span className={it.done ? "text-slate-500 line-through" : "text-slate-200"}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
