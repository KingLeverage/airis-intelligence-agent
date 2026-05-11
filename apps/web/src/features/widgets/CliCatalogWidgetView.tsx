import { useCallback, useEffect, useMemo, useState } from "react";
import type { CliCatalogPayload, WidgetRecord } from "@airis/shared";
import {
  api,
  type CliCatalogCustomProgram,
  type CliToolCatalogEntry,
  type CliToolRunResponse,
} from "../../lib/api";
import { useWidgetsStore } from "../../stores/widgets-store";
import { CLI_CATALOG_MENU_FAMILIES } from "./cli-catalog-families";

const CUSTOM_BUSY = "__custom__";

const FAMILY_ORDER = [
  "coingecko",
  "docker-hub",
  "espn",
  "flight-goat",
  "movie-goat",
  "pypi",
  "recipe-goat",
  "twilio",
  "x-twitter",
] as const;

const DEFAULT_ARGS: Record<CliCatalogCustomProgram, string> = {
  "coingecko-pp-cli": "coins markets --agent",
  "docker-hub-pp-cli": "docker-hub-search search-repositories --agent",
  "pypi-pp-cli": "rss newest-packages --agent",
  "recipe-goat-pp-cli":
    'goat "popular chocolate cake for 8 servings" --limit 8 --agent',
  "espn-pp-cli": "doctor",
  "flight-goat-pp-cli": "doctor",
  "movie-goat-pp-cli": "doctor",
  "twilio-pp-cli": "doctor",
  "x-twitter-pp-cli": "doctor",
};

const DOCS_BY_PROGRAM: Record<CliCatalogCustomProgram, string> = {
  "coingecko-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/payments/coingecko",
  "docker-hub-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/docker-hub",
  "pypi-pp-cli": "https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/pypi",
  "recipe-goat-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/food-and-dining/recipe-goat",
  "espn-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/espn",
  "flight-goat-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/travel/flight-goat",
  "movie-goat-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/movie-goat",
  "twilio-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/social-and-messaging/twilio",
  "x-twitter-pp-cli":
    "https://github.com/mvanhorn/printing-press-library/tree/main/library/social-and-messaging/x-twitter",
};

const ALL_CUSTOM: readonly CliCatalogCustomProgram[] = [
  "coingecko-pp-cli",
  "docker-hub-pp-cli",
  "pypi-pp-cli",
  "recipe-goat-pp-cli",
  "espn-pp-cli",
  "flight-goat-pp-cli",
  "movie-goat-pp-cli",
  "twilio-pp-cli",
  "x-twitter-pp-cli",
];

function isCliCatalogCustomProgram(p: string): p is CliCatalogCustomProgram {
  return (ALL_CUSTOM as readonly string[]).includes(p);
}

function readRecentRuns(data: Record<string, unknown>): unknown[] {
  const r = data.recentRuns;
  return Array.isArray(r) ? r : [];
}

export function CliCatalogWidgetView({ record }: { record: WidgetRecord }) {
  const patchWidgetRecord = useWidgetsStore((s) => s.patchWidgetRecord);
  const [tools, setTools] = useState<CliToolCatalogEntry[]>([]);
  const [customPrograms, setCustomPrograms] = useState<string[]>([]);
  const [runsEnabled, setRunsEnabled] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [customProgram, setCustomProgram] = useState<CliCatalogCustomProgram>("coingecko-pp-cli");
  const [argsText, setArgsText] = useState(DEFAULT_ARGS["coingecko-pp-cli"]);

  const focusFamilyId = useMemo(() => {
    if (record.kind !== "cli-catalog") return undefined;
    const raw = (record.data as CliCatalogPayload).cliFamilyId;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
  }, [record.kind, record.data]);

  const bundledSkillMarkdown = useMemo(() => {
    if (record.kind !== "cli-catalog") return "";
    const raw = (record.data as CliCatalogPayload).bundledSkillMarkdown;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "";
  }, [record.kind, record.data]);

  const presetGroups = useMemo(() => {
    const by = new Map<string, CliToolCatalogEntry[]>();
    for (const t of tools) {
      const list = by.get(t.familyId) ?? [];
      list.push(t);
      by.set(t.familyId, list);
    }
    const keys = [...by.keys()];
    keys.sort((a, b) => {
      const ia = FAMILY_ORDER.indexOf(a as (typeof FAMILY_ORDER)[number]);
      const ib = FAMILY_ORDER.indexOf(b as (typeof FAMILY_ORDER)[number]);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((familyId) => {
      const list = by.get(familyId)!;
      return { familyId, familyLabel: list[0]!.familyLabel, tools: list };
    });
  }, [tools]);

  const presetGroupsVisible = useMemo(
    () => (focusFamilyId ? presetGroups.filter((g) => g.familyId === focusFamilyId) : presetGroups),
    [presetGroups, focusFamilyId],
  );

  const lockedProgram = useMemo(() => {
    if (!focusFamilyId) return null;
    const g = presetGroups.find((x) => x.familyId === focusFamilyId);
    return g?.tools[0]?.program ?? null;
  }, [focusFamilyId, presetGroups]);

  const selectProgramOptions = useMemo((): readonly string[] => {
    if (lockedProgram && isCliCatalogCustomProgram(lockedProgram)) return [lockedProgram];
    return customPrograms.length ? customPrograms : [...ALL_CUSTOM];
  }, [lockedProgram, customPrograms]);

  const loadCatalog = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await api.getCliToolCatalog(record.spaceId);
      setTools(res.tools);
      setRunsEnabled(res.runsEnabled);
      setCustomPrograms([...res.customPrograms]);
      if (!focusFamilyId) {
        const first = ALL_CUSTOM.find((p) => res.customPrograms.includes(p));
        if (first) setCustomProgram(first);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, [record.spaceId, focusFamilyId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!lockedProgram || !isCliCatalogCustomProgram(lockedProgram)) return;
    setCustomProgram(lockedProgram);
    setArgsText(DEFAULT_ARGS[lockedProgram]);
  }, [lockedProgram]);

  useEffect(() => {
    if (selectProgramOptions.length === 0) return;
    if (!selectProgramOptions.includes(customProgram)) {
      const next =
        ALL_CUSTOM.find((p) => selectProgramOptions.includes(p)) ??
        (selectProgramOptions[0] as CliCatalogCustomProgram);
      if (next && isCliCatalogCustomProgram(next)) {
        setCustomProgram(next);
        setArgsText(DEFAULT_ARGS[next]);
      }
    }
  }, [selectProgramOptions, customProgram]);

  const appendRun = (toolKey: string, result: CliToolRunResponse) => {
    const cur = useWidgetsStore.getState().widgets.find((w) => w.id === record.id);
    const base = (cur?.data ?? record.data) as Record<string, unknown>;
    const prev = readRecentRuns(base);
    const commandLine = result.commandLine ?? toolKey;
    const entry = {
      toolKey,
      commandLine,
      readableSummary: result.readableSummary ? result.readableSummary.slice(0, 52_000) : undefined,
      ranAt: new Date().toISOString(),
      exitCode: result.exitCode,
      ok: result.ok,
      durationMs: result.durationMs,
      stdout: result.stdout ? result.stdout.slice(0, 12_000) : undefined,
      stderr: result.stderr ? result.stderr.slice(0, 4_000) : undefined,
    };
    const recentRuns = [entry, ...prev].slice(0, 15);
    void patchWidgetRecord(record.id, {
      data: {
        ...base,
        recentRuns,
      },
    });
  };

  const onRunPreset = async (toolKey: string, programFromPreset?: string) => {
    if (!runsEnabled || busyKey) return;
    setBusyKey(toolKey);
    try {
      const result = await api.runCliTool(record.spaceId, { toolKey });
      appendRun(toolKey, result);
      if (!focusFamilyId && programFromPreset && isCliCatalogCustomProgram(programFromPreset)) {
        setCustomProgram(programFromPreset);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendRun(toolKey, {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: msg,
        durationMs: 0,
        error: "client_error",
        commandLine: toolKey,
        readableSummary: `Run failed before the CLI executed: ${msg}`,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const onRunCustom = async () => {
    if (!runsEnabled || busyKey) return;
    setBusyKey(CUSTOM_BUSY);
    const displayKey = `custom:${customProgram}`;
    try {
      const result = await api.runCliTool(record.spaceId, {
        program: customProgram,
        argsText,
      });
      appendRun(displayKey, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendRun(displayKey, {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: msg,
        durationMs: 0,
        error: "client_error",
        commandLine: `${customProgram} ${argsText}`.trim(),
        readableSummary: `Run failed: ${msg}`,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const recent = readRecentRuns(record.data as Record<string, unknown>);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-sm text-slate-200">
      {!runsEnabled && (
        <p className="rounded-md border border-amber-800/60 bg-amber-950/40 px-2 py-2 text-amber-100/90">
          CLI runs are disabled on this server. Set{" "}
          <code className="text-cyan-300">AIRIS_CLI_TOOLS=1</code> in{" "}
          <code className="text-cyan-300">apps/server/.env</code> (or export it before starting the API), restart
          the server, and ensure Printing Press binaries are installed (see each tool&apos;s install hint).
        </p>
      )}
      {loadErr && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-2 py-2 text-red-200">Failed to load catalog: {loadErr}</p>
      )}
      <details className="rounded-lg border border-slate-800/90 bg-slate-950/40 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-amber-200/95">
          Install Printing Press CLIs (copy-paste)
        </summary>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Replace{" "}
          <code className="text-slate-300">&lt;id&gt;</code> with the library id (same as family id below). Then add{" "}
          <code className="text-slate-300">$HOME/go/bin</code> to <code className="text-slate-300">PATH</code> if the
          installer says the binary is not on PATH. For GUI-started servers, set{" "}
          <code className="text-slate-300">AIRIS_CLI_EXTRA_PATH</code> to that bin directory in{" "}
          <code className="text-slate-300">apps/server/.env</code>.
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-all rounded border border-slate-800 bg-black/30 p-2 font-mono text-[10px] text-emerald-200/90">
          npx -y @mvanhorn/printing-press install {"<id>"} --cli-only{"\n"}
          {"# examples:\n"}
          {CLI_CATALOG_MENU_FAMILIES.map((f) => `npx -y @mvanhorn/printing-press install ${f.id} --cli-only`).join("\n")}
        </pre>
      </details>
      {bundledSkillMarkdown ? (
        <details className="rounded-lg border border-slate-800/90 bg-slate-950/40 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-cyan-400/95">
            Printing Press SKILL.md (bundled)
          </summary>
          <pre className="mt-2 max-h-[min(420px,50vh)] overflow-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-slate-300">
            {bundledSkillMarkdown}
          </pre>
        </details>
      ) : null}
      <p className="text-xs text-slate-400">
        {focusFamilyId ? (
          <>
            This widget is scoped to{" "}
            <strong className="text-slate-300">
              {presetGroupsVisible[0]?.familyLabel ?? focusFamilyId}
            </strong>{" "}
            only (from <strong className="text-slate-300">Pre-Set Widgets → CLI catalog</strong>). Run a preset or use{" "}
            <strong className="text-slate-300">Custom argv</strong> for that binary (no shell, no pipes). Summaries use
            the same optional LLM path as the full catalog; disable with{" "}
            <code className="text-slate-300">AIRIS_CLI_SUMMARY_LLM=0</code>.
          </>
        ) : (
          <>
            Pick a <strong className="text-slate-300">CLI</strong> section below (CoinGecko, Docker Hub, PyPI, …), then
            a preset or use <strong className="text-slate-300">Custom argv</strong> for the allowlisted binaries:{" "}
            <code className="text-slate-300">{customPrograms.join(", ") || "…"}</code> (no shell, no pipes). After each
            run, the server builds a <strong className="text-slate-300">readable summary</strong> (heuristic JSON plus
            optional LLM). Disable the LLM layer with{" "}
            <code className="text-slate-300">AIRIS_CLI_SUMMARY_LLM=0</code>.
          </>
        )}
      </p>
      <div className="space-y-4 pr-1">
        {presetGroupsVisible.map((g) => (
          <section key={g.familyId} className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-500/90">
              {g.familyLabel}{" "}
              <span className="font-mono font-normal normal-case text-slate-500">
                ({g.tools[0]?.program ?? g.familyId})
              </span>
            </div>
            <ul className="space-y-2">
              {g.tools.map((t) => (
                <li
                  key={t.key}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 shadow-sm shadow-black/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-100">{t.label}</div>
                      <p className="mt-1 text-xs leading-snug text-slate-400">{t.description}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{t.installHint}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!runsEnabled || busyKey !== null}
                      onClick={() => void onRunPreset(t.key, t.program)}
                      className="shrink-0 rounded-md bg-cyan-800/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyKey === t.key ? "Running…" : "Run"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom argv</div>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            Program
            {lockedProgram && isCliCatalogCustomProgram(lockedProgram) ? (
              <span className="rounded border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-200">
                {lockedProgram}
              </span>
            ) : (
              <select
                value={customProgram}
                disabled={!runsEnabled || busyKey !== null}
                onChange={(e) => {
                  const p = e.target.value as CliCatalogCustomProgram;
                  setCustomProgram(p);
                  setArgsText(DEFAULT_ARGS[p]);
                }}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              >
                {selectProgramOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </label>
          <button
            type="button"
            disabled={!runsEnabled || busyKey !== null}
            onClick={() => void onRunCustom()}
            className="rounded-md bg-violet-800/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busyKey === CUSTOM_BUSY ? "Running…" : "Run custom"}
          </button>
        </div>
        <textarea
          className="mt-2 min-h-[72px] w-full resize-y rounded border border-slate-700 bg-slate-900/90 px-2 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-cyan-700/40"
          disabled={!runsEnabled || busyKey !== null}
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          placeholder='e.g. goat "best Nashville hot chicken" --limit 8 --agent (quote multi-word queries)'
          spellCheck={false}
        />
        <p className="mt-1 text-[10px] leading-snug text-slate-500">
          Space-separated tokens; use double quotes so the whole dish name is one argument to{" "}
          <code className="text-slate-400">goat</code> (otherwise only the first word is the query). No shell
          metacharacters. Subcommands:{" "}
          <a className="text-cyan-500 underline" href={DOCS_BY_PROGRAM[customProgram]} target="_blank" rel="noreferrer">
            {customProgram} README
          </a>
          .
        </p>
      </div>

      {recent.length > 0 && (
        <div className="border-t border-slate-800 pt-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</div>
          <ul className="space-y-3 pr-1 text-xs">
            {recent.slice(0, 8).map((row, i) => {
              const r = row as Record<string, unknown>;
              const key = typeof r.toolKey === "string" ? r.toolKey : "?";
              const ok = r.ok === true;
              const ex = typeof r.exitCode === "number" ? r.exitCode : "?";
              const cmd = typeof r.commandLine === "string" ? r.commandLine : key;
              const summary = typeof r.readableSummary === "string" ? r.readableSummary : "";
              const out = typeof r.stdout === "string" ? r.stdout : "";
              return (
                <li key={`${key}-${i}`} className="rounded border border-slate-800/80 bg-black/25 p-2">
                  <div className={ok ? "font-medium text-emerald-400" : "font-medium text-amber-400"}>
                    {key} — exit {ex}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-500">{cmd}</div>
                  {summary ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-slate-200">
                      {summary}
                    </pre>
                  ) : null}
                  {out && !summary ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px] text-slate-500">
                      {out}
                    </pre>
                  ) : null}
                  {out && summary ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] text-slate-500">Raw stdout (truncated)</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-slate-500">
                        {out}
                      </pre>
                    </details>
                  ) : null}
                  {typeof r.stderr === "string" && r.stderr ? (
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-amber-300/85">
                      {r.stderr}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
