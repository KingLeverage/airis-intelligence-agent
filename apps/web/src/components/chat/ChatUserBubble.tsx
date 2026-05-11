import type { ChatMessage } from "@airis/shared";
import { BubbleRichText } from "../airis/BubbleRichText";

export type ChatUserBubbleProps = {
  message: Extract<ChatMessage, { role: "user" }>;
};

export function ChatUserBubble({ message }: ChatUserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(100%,22rem)] rounded-2xl rounded-br-md border border-slate-600/50 bg-slate-800/90 px-4 py-2.5 text-sm leading-relaxed text-slate-100 shadow-lg">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">You</div>
        <BubbleRichText text={message.content} />
      </div>
    </div>
  );
}
