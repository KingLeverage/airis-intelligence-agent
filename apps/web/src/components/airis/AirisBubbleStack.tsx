import { BubbleRichText } from "./BubbleRichText";
import { useAirisBubblesStore, type AirisBubbleKind } from "../../stores/airis-bubbles-store";

const kindStyles: Record<
  AirisBubbleKind,
  { wrap: string; bubble: string; meta?: string }
> = {
  reply: {
    wrap: "relative max-w-[min(100vw-2.5rem,28rem)]",
    bubble:
      "rounded-[1.75rem] rounded-bl-md border border-white/25 bg-gradient-to-br from-white/[0.97] to-slate-50/[0.98] px-4 py-3.5 text-[13px] leading-relaxed text-slate-900 shadow-[0_18px_50px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
  },
  action: {
    wrap: "relative max-w-[min(100vw-2.5rem,24rem)]",
    bubble:
      "rounded-2xl rounded-bl-sm border border-violet-300/35 bg-gradient-to-br from-violet-50/95 to-slate-50/95 px-3.5 py-2.5 text-xs text-violet-950 shadow-lg",
    meta: "text-violet-700/85",
  },
  success: {
    wrap: "relative max-w-[min(100vw-2.5rem,22rem)]",
    bubble:
      "rounded-xl rounded-bl-sm border border-emerald-300/40 bg-gradient-to-br from-emerald-50/95 to-teal-50/90 px-3 py-2 text-[11.5px] text-emerald-950 shadow-md",
    meta: "text-emerald-800/85",
  },
  warning: {
    wrap: "relative max-w-[min(100vw-2.5rem,24rem)]",
    bubble:
      "rounded-2xl rounded-bl-sm border border-amber-300/45 bg-gradient-to-br from-amber-50/95 to-orange-50/90 px-3.5 py-2.5 text-xs text-amber-950 shadow-lg",
    meta: "text-amber-900/85",
  },
  error: {
    wrap: "relative max-w-[min(100vw-2.5rem,24rem)]",
    bubble:
      "rounded-2xl rounded-bl-sm border border-rose-300/45 bg-gradient-to-br from-rose-50/95 to-red-50/90 px-3.5 py-2.5 text-xs text-rose-950 shadow-lg",
    meta: "text-rose-900/85",
  },
  thinking: {
    wrap: "relative max-w-[min(100vw-2.5rem,20rem)]",
    bubble:
      "rounded-full border border-white/12 bg-[color:rgba(12,20,34,0.72)] px-4 py-2 text-[color:var(--airis-text-tertiary)] shadow-md backdrop-blur-md",
    meta: "text-[color:rgba(180,200,230,0.55)]",
  },
};

export function AirisBubbleStack() {
  const bubbles = useAirisBubblesStore((s) => s.bubbles);
  if (bubbles.length === 0) return null;
  return (
    <div className="flex max-w-[min(100vw-2rem,30rem)] flex-col items-start gap-3.5">
      {bubbles.map((b) => {
        const st = kindStyles[b.kind];
        const isThinking = b.kind === "thinking";
        const isReply = b.kind === "reply";
        return (
          <div key={b.id} className={`airis-motion group ${st.wrap}`}>
            {isReply ? (
              <div
                className="pointer-events-none absolute -bottom-1.5 left-5 h-3 w-3 rotate-45 border-b border-r border-white/20 bg-gradient-to-br from-white to-slate-50 shadow-sm"
                aria-hidden
              />
            ) : null}
            <div
              className={`relative backdrop-blur-xl ${st.bubble} ${
                isThinking ? "text-[12px]" : ""
              }`}
            >
              {!isThinking && !isReply && (
                <span
                  className={`mb-1 block text-[10px] font-semibold tracking-wide ${st.meta ?? "opacity-80"}`}
                >
                  {b.kind === "success" ? "Update" : b.kind === "warning" ? "Heads up" : b.kind === "error" ? "Hmm" : "Note"}
                </span>
              )}
              {isThinking ? (
                <span className="inline-flex items-center gap-2 pr-0.5">
                  <span className={`text-[11px] font-semibold ${st.meta}`}>AIRIS</span>
                  <span className="text-[11px] text-slate-300/95">{b.text}</span>
                  <span className="inline-flex gap-0.5 text-slate-400/80" aria-hidden>
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                </span>
              ) : (
                <BubbleRichText text={b.text} className="whitespace-pre-wrap" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
