import type { ChatMessage } from "@airis/shared";
import { BubbleRichText } from "../airis/BubbleRichText";

/** Same panel chrome as before: any non-user row uses the AIRIS bubble (assistant, system, tool, …). */
export type ChatAssistantBubbleProps = {
  message: Exclude<ChatMessage, { role: "user" }>;
};

export function ChatAssistantBubble({ message }: ChatAssistantBubbleProps) {
  return (
    <div className="flex justify-start">
      <div className="relative max-w-[min(100%,26rem)]">
        <div
          className="pointer-events-none absolute -bottom-1 left-5 h-2.5 w-2.5 rotate-45 border-b border-r border-white/15 bg-gradient-to-br from-white to-slate-50"
          aria-hidden
        />
        <div className="rounded-[1.5rem] rounded-bl-md border border-white/20 bg-gradient-to-br from-white/[0.97] to-slate-50/[0.98] px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">AIRIS</div>
          <BubbleRichText text={message.content} />
        </div>
      </div>
    </div>
  );
}
