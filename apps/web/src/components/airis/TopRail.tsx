import { useState } from "react";
import { DEFAULT_LLM_MODEL_ID } from "@airis/shared";
import { useSpacesStore } from "../../stores/spaces-store";
import { useWidgetsStore } from "../../stores/widgets-store";
import { AIRIS_THEMES, useSessionStore } from "../../stores/session-store";
import { ReferenceLibraryModal } from "./ReferenceLibraryModal";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { WidgetLibraryMenu } from "./WidgetLibraryMenu";

type Props = {
  variant: "home" | "space";
  showStartFastReopen?: boolean;
  onShowStartFast?: () => void;
};

const PRESET_MODEL_VALUES = new Set([
  "mock",
  "anthropic",
  "openai",
  "openrouter",
  "openrouter:openai/gpt-4o-mini",
  "openrouter:openai/gpt-4.1-nano",
  "openrouter:openai/gpt-5.4-image-2",
  "openrouter:google/gemini-2.0-flash-001",
  "openrouter:anthropic/claude-3.5-haiku",
  "openrouter:anthropic/claude-haiku-4.5",
  "openrouter:anthropic/claude-3.5-sonnet",
  "openrouter:anthropic/claude-opus-4.7",
  "openrouter:anthropic/claude-opus-4.7-fast",
  "openrouter:inclusionai/ring-2.6-1t:free",
  "openrouter:nvidia/llama-3.3-nemotron-super-49b-v1.5",
]);

export function TopRail({ variant, showStartFastReopen, onShowStartFast }: Props) {
  const [refLibOpen, setRefLibOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const exitToHome = useSpacesStore((s) => s.exitToHome);
  const space = useWidgetsStore((s) => s.space);
  const modelId = useSessionStore((s) => s.modelId);
  const setModelId = useSessionStore((s) => s.setModelId);
  const runStatus = useSessionStore((s) => s.runStatus);
  const theme = useSessionStore((s) => s.theme);
  const toggleTheme = useSessionStore((s) => s.toggleTheme);
  const refreshSpace = useSessionStore((s) => s.refreshSpace);
  const nextTheme = AIRIS_THEMES[(AIRIS_THEMES.indexOf(theme) + 1) % AIRIS_THEMES.length] ?? AIRIS_THEMES[0];
  const showCustomModelOption = !PRESET_MODEL_VALUES.has(modelId);

  return (
    <>
      <ReferenceLibraryModal open={refLibOpen} onClose={() => setRefLibOpen(false)} />
      <CreateWorkspaceDialog open={createWorkspaceOpen} onClose={() => setCreateWorkspaceOpen(false)} />
      <header className="airis-glass-2 relative flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--airis-border-glass)] px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {variant === "space" && (
          <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--airis-accent-iris)] sm:inline">
            AIRIS
          </span>
        )}
        {variant === "home" && (
          <button
            type="button"
            onClick={() => setCreateWorkspaceOpen(true)}
            className="shrink-0 rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass)] bg-[color:rgba(255,255,255,0.04)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--airis-text-primary)] hover:border-[color:var(--airis-border-glass-strong)]"
          >
            + New space
          </button>
        )}
        {variant === "space" && space && (
          <div className="min-w-0 sm:max-w-[40%]">
            <div className="truncate text-sm font-medium text-[color:var(--airis-text-primary)]">{space.name}</div>
            <div className="truncate font-mono text-[10px] text-[color:var(--airis-text-tertiary)]">{space.slug}</div>
          </div>
        )}
        {variant === "home" && (
          <div className="pointer-events-none absolute left-1/2 hidden min-w-0 -translate-x-1/2 text-center sm:block">
            <span className="text-[11px] text-[color:var(--airis-text-tertiary)]">
              <span className="text-[color:var(--airis-accent-iris)]">AIRIS</span>
              <span className="mx-1.5 opacity-50">/</span>
              <span>Home</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        {variant === "home" && showStartFastReopen && (
          <button
            type="button"
            onClick={() => onShowStartFast?.()}
            className="rounded-lg border border-[color:var(--airis-border-glass)] px-2 py-1 text-[10px] font-medium text-[color:var(--airis-accent-iris)] hover:bg-[color:rgba(134,183,255,0.08)]"
          >
            Start fast
          </button>
        )}
        {variant === "space" && (
          <>
            <button
              type="button"
              className="rounded-lg border border-[color:var(--airis-border-glass)] px-2 py-1 text-[10px] text-[color:var(--airis-text-secondary)] hover:border-[color:var(--airis-border-glass-strong)]"
              onClick={() => void exitToHome()}
            >
              ← Spaces
            </button>
            <WidgetLibraryMenu />
            <button
              type="button"
              className="rounded-lg border border-[color:var(--airis-border-glass)] px-2 py-1 text-[10px] text-[color:var(--airis-text-secondary)] hover:border-[color:var(--airis-accent-iris)]"
              title="Upload PDFs, images, and notes for search and chat context"
              onClick={() => setRefLibOpen(true)}
            >
              Ref library
            </button>
          </>
        )}
        <label className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 text-[10px] text-[color:var(--airis-text-tertiary)] sm:max-w-[min(100%,18rem)]">
          <span className="hidden shrink-0 sm:inline">Model</span>
          <select
            id="airis-model-select"
            title="Chat model / provider"
            className="min-w-0 flex-1 rounded-md border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.6)] px-1 py-0.5 text-[10px] text-[color:var(--airis-text-primary)]"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          >
            <option value={DEFAULT_LLM_MODEL_ID}>nvidia/llama-3.3-nemotron-super-49b-v1.5 (default)</option>
            <option value="anthropic">anthropic</option>
            <option value="openai">openai</option>
            <option value="openrouter">openrouter</option>
            <option value="openrouter:inclusionai/ring-2.6-1t:free">inclusionai/ring-2.6-1t:free</option>
            <option value="openrouter:openai/gpt-4o-mini">OR 4o-mini</option>
            <option value="openrouter:openai/gpt-4.1-nano">OR 4.1-nano</option>
            <option value="openrouter:openai/gpt-5.4-image-2">OR gpt-5.4-image-2</option>
            <option value="openrouter:google/gemini-2.0-flash-001">OR gemini-flash</option>
            <option value="openrouter:anthropic/claude-3.5-haiku">OR haiku</option>
            <option value="openrouter:anthropic/claude-haiku-4.5">anthropic/claude-haiku-4.5</option>
            <option value="openrouter:anthropic/claude-3.5-sonnet">OR claude-3.5-sonnet</option>
            <option value="openrouter:anthropic/claude-opus-4.7">anthropic/claude-opus-4.7</option>
            <option value="openrouter:anthropic/claude-opus-4.7-fast">anthropic/claude-opus-4.7-fast</option>
            <option value="mock" disabled title="Offline mock mode is paused — use OpenRouter with an API key.">
              mock (paused)
            </option>
            {showCustomModelOption ? (
              <option value={modelId}>
                {modelId.length > 36 ? `${modelId.slice(0, 34)}…` : modelId}
              </option>
            ) : null}
          </select>
        </label>
        <div
          className={`h-1.5 w-1.5 rounded-full ${runStatus === "running" ? "animate-pulse bg-[color:var(--airis-accent-gold)]" : "bg-[color:var(--airis-accent-success)]"}`}
          title={runStatus}
        />
        <button
          type="button"
          className="rounded-lg border border-[color:var(--airis-border-glass)] px-2 py-1 text-[10px] text-[color:var(--airis-text-secondary)]"
          title={`Theme: ${nextTheme.replace(/-/g, " ")}`}
          onClick={() => toggleTheme()}
        >
          <span className="hidden sm:inline">{theme.replace(/-/g, " ")}</span>
          <span className="sm:hidden">◐</span>
        </button>
        {variant === "space" && (
          <button
            type="button"
            className="rounded-lg border border-[color:var(--airis-border-glass)] px-2 py-1 text-[10px] text-[color:var(--airis-text-secondary)]"
            onClick={() => void refreshSpace()}
          >
            Refresh
          </button>
        )}
      </div>
    </header>
    </>
  );
}
