import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRecord } from "@airis/shared";
import { RockPaperScissorsPanelPayloadSchema, type RockPaperScissorsPanelPayload } from "@airis/shared";
import { useWidgetsStore } from "../../stores/widgets-store";

type Choice = "rock" | "paper" | "scissors";

const CHOICES: readonly Choice[] = ["rock", "paper", "scissors"];

const LABEL: Record<Choice, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

const EMOJI: Record<Choice, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

function outcome(player: Choice, ai: Choice): "win" | "lose" | "draw" {
  if (player === ai) return "draw";
  if (
    (player === "rock" && ai === "scissors") ||
    (player === "scissors" && ai === "paper") ||
    (player === "paper" && ai === "rock")
  ) {
    return "win";
  }
  return "lose";
}

export function RockPaperScissorsPanelWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const payload = useMemo(() => RockPaperScissorsPanelPayloadSchema.parse(record.data), [record.data]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const rngRef = useRef(() => Math.random());

  const [last, setLast] = useState<{ player: Choice; ai: Choice; result: "win" | "lose" | "draw" } | null>(null);

  const patchData = useCallback(
    (partial: Partial<RockPaperScissorsPanelPayload>) => {
      void patchWidgetRecord(record.id, { data: partial });
    },
    [patchWidgetRecord, record.id],
  );

  const play = useCallback(
    (player: Choice) => {
      const ai = CHOICES[Math.floor(rngRef.current() * CHOICES.length)]!;
      const result = outcome(player, ai);
      setLast({ player, ai, result });
      const p = payloadRef.current;
      if (result === "win") patchData({ winsVsAi: p.winsVsAi + 1 });
      else if (result === "lose") patchData({ lossesVsAi: p.lossesVsAi + 1 });
      else patchData({ drawsVsAi: p.drawsVsAi + 1 });
    },
    [patchData],
  );

  useEffect(() => {
    setLast(null);
  }, [record.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        play("rock");
      } else if (k === "p") {
        e.preventDefault();
        play("paper");
      } else if (k === "s") {
        e.preventDefault();
        play("scissors");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  const verdict =
    last == null
      ? null
      : last.result === "win"
        ? "You win"
        : last.result === "lose"
          ? "AI wins"
          : "Draw";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1">
      {payload.subtitle ? <p className="text-[11px] text-slate-400">{payload.subtitle}</p> : null}

      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span>
          You: <span className="font-mono text-teal-200">{payload.winsVsAi}</span>
        </span>
        <span>
          AI: <span className="font-mono text-rose-200/80">{payload.lossesVsAi}</span>
        </span>
        <span>
          Draws: <span className="font-mono text-slate-300">{payload.drawsVsAi}</span>
        </span>
      </div>

      <p className="text-[12px] text-slate-400">Pick a throw. AI plays uniformly at random. Keys: R · P · S</p>

      <div className="flex flex-wrap justify-center gap-2">
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => play(c)}
            className="flex min-w-[5.5rem] flex-col items-center gap-1 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-[12px] font-semibold text-slate-100 hover:border-teal-600/50 hover:bg-slate-800 sm:min-w-[6.5rem]"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {EMOJI[c]}
            </span>
            {LABEL[c]}
          </button>
        ))}
      </div>

      {last ? (
        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-[12px] text-slate-300">
          <p>
            You <span className="font-medium text-slate-100">{EMOJI[last.player]}</span> {LABEL[last.player]} · AI{" "}
            <span className="font-medium text-slate-100">{EMOJI[last.ai]}</span> {LABEL[last.ai]}
          </p>
          <p
            className={`mt-1 font-medium ${
              last.result === "win" ? "text-teal-200" : last.result === "lose" ? "text-rose-200" : "text-slate-400"
            }`}
          >
            {verdict}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Last throw appears here.</p>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        Catalog #17: RPS vs random AI. Agent kind <code className="text-slate-400">rock-paper-scissors-panel</code>.
      </p>
    </div>
  );
}
