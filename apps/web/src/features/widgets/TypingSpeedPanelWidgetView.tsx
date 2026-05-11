import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { TypingSpeedPanelPayloadSchema, type TypingSpeedPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

const PASSAGES = [
  "The quick brown fox adapts to any workspace theme without breaking stride.",
  "AIRIS widgets persist to disk with Zod validation on every read and write.",
  "Ship small diffs that match local naming style and avoid unrelated refactors.",
  "Practice typing in short bursts and reset when you want a new random line.",
  "Headless browser hooks stay on the server never executing raw model JavaScript.",
  "Solid latency beats flashy chrome when the operator is waiting on real results.",
] as const;

function pickPassage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PASSAGES[h % PASSAGES.length]!;
}

export function TypingSpeedPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => TypingSpeedPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const [passage, setPassage] = useState(() => pickPassage(record.id));
  const [typed, setTyped] = useState("");
  const startedAtRef = useRef<number | null>(null);
  const [done, setDone] = useState(false);
  const [lastWpm, setLastWpm] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patchData = useCallback(
    (partial: Partial<TypingSpeedPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const resetPassage = useCallback((next: string) => {
    setPassage(next);
    setTyped("");
    startedAtRef.current = null;
    setDone(false);
    setLastWpm(null);
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    resetPassage(pickPassage(record.id));
  }, [record.id, resetPassage]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (done) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      const nextChar = passage[typed.length];
      if (nextChar === undefined) return;
      if (e.key !== nextChar) return;

      const now = performance.now();
      if (startedAtRef.current === null) startedAtRef.current = now;

      const nextTyped = typed + e.key;
      setTyped(nextTyped);

      if (nextTyped.length === passage.length) {
        const start = startedAtRef.current ?? now;
        const elapsedMin = (now - start) / 60000;
        const grossWpm = elapsedMin > 0 ? Math.round((passage.length / 5) / elapsedMin) : 0;
        setDone(true);
        setLastWpm(grossWpm);
        const prev = payloadRef.current.bestWpm;
        if (grossWpm > prev) patchData({ bestWpm: grossWpm });
      }
    },
    [done, passage, typed, startedAt, patchData],
  );

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span>
          Best WPM: <span className="font-mono text-teal-300">{payload.bestWpm > 0 ? payload.bestWpm : "—"}</span>
        </span>
        {lastWpm != null ? (
          <span>
            Last: <span className="font-mono text-slate-300">{lastWpm}</span>
          </span>
        ) : null}
        {typed.length > 0 && !done ? (
          <span className="text-slate-500">Typing…</span>
        ) : done ? (
          <span className="text-emerald-400/90">Complete</span>
        ) : null}
      </div>

      <p className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 font-mono text-[13px] leading-relaxed tracking-wide text-slate-100">
        {passage.split("").map((ch, i) => {
          let cls = "text-slate-600";
          if (i < typed.length) cls = typed[i] === ch ? "text-emerald-400" : "text-rose-400";
          else if (i === typed.length && !done) cls = "border-b border-cyan-500 text-slate-200";
          return (
            <span key={`${i}-${ch}`} className={cls}>
              {ch}
            </span>
          );
        })}
      </p>

      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Typing input"
        disabled={done}
        value=""
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onPaste={(e) => e.preventDefault()}
        className="w-full rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 font-mono text-sm text-slate-200 outline-none focus:border-cyan-700/50 disabled:opacity-50"
        placeholder={done ? "Run finished — new line below" : "Click here and type the line above…"}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-teal-800/70 bg-teal-950/50 px-3 py-1.5 text-[11px] font-semibold text-teal-100 hover:border-teal-500"
          onClick={() => resetPassage(PASSAGES[Math.floor(Math.random() * PASSAGES.length)]!)}
        >
          New line
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #21: gross WPM on fixed passages (wrong keys ignored). Agent kind{" "}
        <code className="text-slate-400">typing-speed-panel</code>.
      </p>
    </div>
  );
}
