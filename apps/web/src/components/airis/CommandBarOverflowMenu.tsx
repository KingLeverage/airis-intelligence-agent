import type { ReactNode } from "react";

const iconGlow = "text-[#5eead4] drop-shadow-[0_0_10px_rgba(45,212,191,0.75)]";

function IconFullMode({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconAttach({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconCompact({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 12h8M6 8l-2 2 2 2M18 8l2 2-2 2" />
    </svg>
  );
}

function IconClear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v7h-7" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M9 14h6M15 7h6M5 18h2" />
    </svg>
  );
}

type RowProps = {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  trailing?: ReactNode;
};

function MenuRow({ icon, children, onClick, danger, trailing }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-[color:rgba(45,212,191,0.08)] ${
        danger ? "text-[#fda4af] hover:bg-[color:rgba(251,113,133,0.08)]" : "text-[color:var(--airis-text-primary)]"
      }`}
    >
      <span className={`shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] ${danger ? "text-[#fb7185]" : iconGlow}`}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
    </button>
  );
}

export type CommandBarOverflowMenuProps = {
  open: boolean;
  onClose: () => void;
  fullMode: boolean;
  onToggleFullMode: () => void;
  compactContext: boolean;
  onToggleCompactContext: () => void;
  onAttachClick: () => void;
  onClearChat: () => void;
  onOpenHistory: () => void;
  onModelSettings: () => void;
  canClearChat: boolean;
};

export function CommandBarOverflowMenu({
  open,
  onClose,
  fullMode,
  onToggleFullMode,
  compactContext,
  onToggleCompactContext,
  onAttachClick,
  onClearChat,
  onOpenHistory,
  onModelSettings,
  canClearChat,
}: CommandBarOverflowMenuProps) {
  if (!open) return null;

  return (
    <div
      role="menu"
      className="pointer-events-auto absolute bottom-[calc(100%+8px)] right-0 z-[200] min-w-[220px] rounded-2xl border border-[color:rgba(45,212,191,0.28)] bg-[color:rgba(6,12,22,0.92)] py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_24px_rgba(45,212,191,0.12)] backdrop-blur-xl"
    >
      <MenuRow
        icon={<IconFullMode />}
        onClick={() => {
          onToggleFullMode();
          onClose();
        }}
        trailing={
          fullMode ? (
            <span className="text-[10px] font-semibold text-[#5eead4] drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]">On</span>
          ) : null
        }
      >
        Full mode
      </MenuRow>
      <MenuRow
        icon={<IconAttach />}
        onClick={() => {
          onAttachClick();
          onClose();
        }}
      >
        Attachment
      </MenuRow>
      <MenuRow
        icon={<IconCompact />}
        onClick={() => {
          onToggleCompactContext();
          onClose();
        }}
        trailing={
          compactContext ? (
            <span className="text-[10px] font-semibold text-[#5eead4] drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]">On</span>
          ) : null
        }
      >
        Compact context
      </MenuRow>
      <MenuRow
        icon={<IconClear />}
        danger
        onClick={() => {
          onClearChat();
          onClose();
        }}
        trailing={!canClearChat ? <span className="text-[10px] text-[color:var(--airis-text-tertiary)]">No space</span> : null}
      >
        Clear chat
      </MenuRow>
      <MenuRow
        icon={<IconHistory />}
        onClick={() => {
          onOpenHistory();
          onClose();
        }}
      >
        History
      </MenuRow>
      <MenuRow
        icon={<IconSliders />}
        onClick={() => {
          onModelSettings();
          onClose();
        }}
      >
        Model & API settings
      </MenuRow>
    </div>
  );
}
