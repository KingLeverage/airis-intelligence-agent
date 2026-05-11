export type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Message the agent…",
}: ChatComposerProps) {
  return (
    <form
      className="flex gap-2 border-t border-slate-800 p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!value.trim() || disabled) return;
        onSend();
      }}
    >
      <textarea
        className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none"
        placeholder={placeholder}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="submit"
        disabled={disabled}
        className="h-11 shrink-0 self-end rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
      >
        {disabled ? "…" : "Send"}
      </button>
    </form>
  );
}
