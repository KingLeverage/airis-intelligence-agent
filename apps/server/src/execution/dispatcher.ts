import type { FastifyBaseLogger } from "fastify";
import fs from "node:fs/promises";
import { v4 as uuid } from "uuid";
import type { ZodIssue } from "zod";
import type { BrowserSession, ParsedExecutionBlock } from "@airis/shared";
import {
  assertExportPdfPayloadSize,
  assertPdfChartEmbedBudget,
  ExportPdfPayloadSchema,
  LayoutStateSchema,
  defaultLayoutForKind,
  expandDashboardRecipe,
  layoutForWorkspaceComposeIndex,
  nudgeLayoutBelowConflicts,
  parseWidgetPayload,
  stackLayoutForIndex,
  WidgetDataSourceConfigSchema,
  WidgetRenderConfigSchema,
  WorkspaceComposePayloadSchema,
  WorkflowRunPayloadSchema,
  type WidgetKind,
  type WidgetRecord,
} from "@airis/shared";
import * as store from "../persistence/space-store.js";
import { ensureDir } from "../persistence/fs-utils.js";
import { spaceExportPdfPath, spaceExportsDir } from "../persistence/paths.js";
import { renderComparisonPanelToPng } from "../services/pdf/comparison-panel-to-png.js";
import { renderChartPanelToPng } from "../services/pdf/chart-panel-to-png.js";
import { renderMetricGridToPng } from "../services/pdf/metric-grid-to-png.js";
import { renderPdfBuffer, sanitizePdfFilename } from "../services/pdf/pdf-generation.js";
import { createSnapshot } from "../snapshots/service.js";
import { snapshotAfterMutation } from "../snapshots/hooks.js";
import { dispatchBrowserExecution } from "../browser/browser-action-dispatcher.js";
import { invalidateBrowserSessionCache } from "../browser/session-store.js";
import { DEFAULT_USER_ID, isCliToolsRunEnabled } from "../config.js";
import { getCliToolByKey } from "../services/cli-tools/cli-tool-registry.js";
import { mergeBundledSkillIntoCliCatalogData } from "../services/cli-tools/attach-bundled-cli-skill.js";
import { enrichCliRunForSpace } from "../services/cli-tools/enrich-cli-run.js";
import { parseArgsText } from "../services/cli-tools/parse-cli-args.js";
import { runAllowlistedCliTool, runCustomCliFromText } from "../services/cli-tools/run-cli-tool.js";
import { composeLeadFinderMapsQuery, runLeadFinderForSpace } from "../services/lead-finder-runner.js";

export type DispatchResult = {
  ok: boolean;
  message: string;
  detail?: string;
  /** When multiple widgets are created in one dispatch */
  composedWidgetIds?: string[];
  composedWidgetKinds?: string[];
  browser?: { implemented: boolean; message: string; session: BrowserSession };
  /** Populated when `export.pdf` writes a file under the space `exports/` directory. */
  pdfExport?: { exportId: string; filename: string };
  /** Populated when `cli.tool.run` completes (includes LLM/heuristic readable summary). */
  cliToolRun?: {
    ok: boolean;
    exitCode: number;
    commandLine: string;
    readableSummary: string;
    stdout: string;
    stderr: string;
    durationMs: number;
  };
  /** Populated when `workflow.run` completes (e.g. lead-finder widget). */
  workflowRun?: {
    widgetId: string;
    kind: string;
    businessCount: number;
    avgBadness: number | null;
  };
};

function normalizeWidgetData(kind: WidgetKind, payload: Record<string, unknown>): Record<string, unknown> {
  const data = parseWidgetPayload(kind, payload);
  return data as Record<string, unknown>;
}

function parseOptionalRenderConfig(raw: unknown) {
  if (raw == null || typeof raw !== "object") return undefined;
  const p = WidgetRenderConfigSchema.safeParse(raw);
  return p.success ? p.data : undefined;
}

async function maybeSnapshot(
  spaceId: string,
  _reason: "mutation",
  affected: string[],
  userId: string,
): Promise<void> {
  const label = `execution:${affected[0] ?? "mutation"}`;
  await snapshotAfterMutation(spaceId, userId, label, affected);
}

export async function dispatchExecution(
  block: ParsedExecutionBlock,
  spaceId: string,
  userId: string = DEFAULT_USER_ID,
  log?: FastifyBaseLogger,
): Promise<DispatchResult> {
  try {
    switch (block.type) {
      case "widget.create": {
        const kind = block.widgetKind;
        if (!kind) return { ok: false, message: "widget.create_missing_kind" };
        const title =
          block.title ??
          (typeof block.payload.title === "string" ? block.payload.title : undefined) ??
          "Untitled";
        let data = normalizeWidgetData(kind, block.payload);
        if (kind === "cli-catalog") {
          data = mergeBundledSkillIntoCliCatalogData(data as Record<string, unknown>) as typeof data;
        }
        const id = uuid();
        const now = new Date().toISOString();
        const existing = await store.listWidgetRecords(spaceId, userId);
        const n = existing.length;
        const stacked = stackLayoutForIndex(kind, n);
        const lx = typeof block.payload.x === "number" ? block.payload.x : stacked.x;
        const ly = typeof block.payload.y === "number" ? block.payload.y : stacked.y;
        const lw = typeof block.payload.w === "number" ? block.payload.w : stacked.w;
        const lh = typeof block.payload.h === "number" ? block.payload.h : stacked.h;
        const resolvedLayout = nudgeLayoutBelowConflicts(
          { x: lx, y: ly, w: lw, h: lh },
          existing,
        );
        const renderConfig = parseOptionalRenderConfig(block.payload.renderConfig);
        const authoringNote =
          typeof block.payload.authoringNote === "string" ? block.payload.authoringNote : undefined;
        const dataSource =
          block.payload.dataSource != null
            ? WidgetDataSourceConfigSchema.safeParse(block.payload.dataSource).data
            : undefined;
        const record: WidgetRecord = {
          id,
          spaceId,
          kind,
          title,
          createdAt: now,
          updatedAt: now,
          version: 1,
          data,
          layout: {
            x: resolvedLayout.x,
            y: resolvedLayout.y,
            w: resolvedLayout.w,
            h: resolvedLayout.h,
          },
          renderConfig,
          status: "ok",
          authoringNote,
          dataSource,
        };
        await store.saveWidget(record, userId);
        await maybeSnapshot(spaceId, "mutation", [id], userId);
        return { ok: true, message: "widget_created", detail: id };
      }
      case "widget.createMany":
      case "workspace.compose": {
        const parsed = WorkspaceComposePayloadSchema.safeParse(block.payload);
        if (!parsed.success) {
          return { ok: false, message: "invalid_compose_payload", detail: parsed.error.message };
        }
        const ids: string[] = [];
        const kinds: string[] = [];
        const now = new Date().toISOString();
        const existingCompose = await store.listWidgetRecords(spaceId, userId);
        const placed: WidgetRecord[] = [...existingCompose];

        if (parsed.data.recipe != null) {
          for (const b of expandDashboardRecipe(parsed.data.recipe)) {
            const wid = uuid();
            let data = normalizeWidgetData(b.kind, b.payload as Record<string, unknown>);
            if (b.kind === "cli-catalog") {
              data = mergeBundledSkillIntoCliCatalogData(data as Record<string, unknown>) as typeof data;
            }
            const layout = nudgeLayoutBelowConflicts(b.layout, placed);
            const rec: WidgetRecord = {
              id: wid,
              spaceId,
              kind: b.kind,
              title: b.title,
              createdAt: now,
              updatedAt: now,
              version: 1,
              data,
              layout,
              status: "ok",
              dataSource: b.dataSource,
            };
            await store.saveWidget(rec, userId);
            placed.push(rec);
            ids.push(wid);
            kinds.push(b.kind);
          }
        } else {
          let composeIndex = 0;
          for (const w of parsed.data.widgets!) {
            const wid = uuid();
            const def = defaultLayoutForKind(w.widgetKind);
            let data = normalizeWidgetData(w.widgetKind, w.payload as Record<string, unknown>);
            if (w.widgetKind === "cli-catalog") {
              data = mergeBundledSkillIntoCliCatalogData(data as Record<string, unknown>) as typeof data;
            }
            const explicit =
              typeof w.x === "number" &&
              typeof w.y === "number" &&
              Number.isFinite(w.x) &&
              Number.isFinite(w.y);
            let layout = explicit
              ? {
                  x: w.x!,
                  y: w.y!,
                  w: typeof w.w === "number" && Number.isFinite(w.w) ? w.w : def.w,
                  h: typeof w.h === "number" && Number.isFinite(w.h) ? w.h : def.h,
                }
              : layoutForWorkspaceComposeIndex(composeIndex, w.widgetKind);
            composeIndex += 1;
            layout = nudgeLayoutBelowConflicts(layout, placed);
            const rec: WidgetRecord = {
              id: wid,
              spaceId,
              kind: w.widgetKind,
              title: w.title,
              createdAt: now,
              updatedAt: now,
              version: 1,
              data,
              layout,
              renderConfig: w.renderConfig,
              status: "ok",
              authoringNote: w.authoringNote,
              dataSource: w.dataSource,
            };
            await store.saveWidget(rec, userId);
            placed.push(rec);
            ids.push(wid);
            kinds.push(w.widgetKind);
          }
        }

        await maybeSnapshot(spaceId, "mutation", ids, userId);
        return {
          ok: true,
          message: "workspace_composed",
          detail: ids.join(","),
          composedWidgetIds: ids,
          composedWidgetKinds: kinds,
        };
      }
      case "widget.update": {
        const wid =
          block.widgetId ??
          (typeof block.payload.widgetId === "string" ? block.payload.widgetId : undefined);
        if (!wid) return { ok: false, message: "widget.update_missing_id" };
        const existing = await store.getWidget(spaceId, wid, userId);
        if (!existing) return { ok: false, message: "widget_not_found" };
        const nextData =
          block.payload.data && typeof block.payload.data === "object"
            ? { ...existing.data, ...(block.payload.data as object) }
            : { ...existing.data, ...block.payload };
        const kind = existing.kind;
        normalizeWidgetData(kind, nextData as Record<string, unknown>);
        const updated: WidgetRecord = {
          ...existing,
          title:
            block.title ??
            (typeof block.payload.title === "string" ? block.payload.title : existing.title),
          data: nextData as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
          version: existing.version + 1,
          status: "ok",
          lastError: undefined,
        };
        await store.saveWidget(updated, userId);
        await maybeSnapshot(spaceId, "mutation", [wid], userId);
        return { ok: true, message: "widget_updated" };
      }
      case "widget.move":
      case "widget.resize": {
        const wid =
          block.widgetId ??
          (typeof block.payload.widgetId === "string" ? block.payload.widgetId : undefined);
        if (!wid) return { ok: false, message: `${block.type}_missing_id` };
        const existing = await store.getWidget(spaceId, wid, userId);
        if (!existing) return { ok: false, message: "widget_not_found" };
        const nextLayout = {
          ...existing.layout,
          ...(typeof block.payload.x === "number" ? { x: block.payload.x } : {}),
          ...(typeof block.payload.y === "number" ? { y: block.payload.y } : {}),
          ...(typeof block.payload.w === "number" ? { w: block.payload.w } : {}),
          ...(typeof block.payload.h === "number" ? { h: block.payload.h } : {}),
        };
        const updated: WidgetRecord = {
          ...existing,
          layout: nextLayout,
          updatedAt: new Date().toISOString(),
          version: existing.version + 1,
          status: "ok",
          lastError: undefined,
        };
        await store.saveWidget(updated, userId);
        await maybeSnapshot(spaceId, "mutation", [wid], userId);
        return { ok: true, message: block.type === "widget.move" ? "widget_moved" : "widget_resized" };
      }
      case "widget.delete": {
        const wid =
          block.widgetId ??
          (typeof block.payload.widgetId === "string" ? block.payload.widgetId : undefined);
        if (!wid) return { ok: false, message: "widget.delete_missing_id" };
        await store.deleteWidgetFile(spaceId, wid, userId);
        await maybeSnapshot(spaceId, "mutation", [wid], userId);
        return { ok: true, message: "widget_deleted" };
      }
      case "layout.update": {
        const rawLayout = block.payload.layout;
        const p = LayoutStateSchema.safeParse(rawLayout);
        if (!p.success) return { ok: false, message: "invalid_layout", detail: p.error.message };
        await store.writeLayout(spaceId, p.data, userId);
        await maybeSnapshot(spaceId, "mutation", ["layout"], userId);
        return { ok: true, message: "layout_updated" };
      }
      case "browser.navigate":
      case "browser.back":
      case "browser.click":
      case "browser.type":
      case "browser.scroll":
      case "browser.evaluate": {
        const out = await dispatchBrowserExecution(block, spaceId, userId);
        return {
          ok: out.ok,
          message: out.message,
          detail: out.detail,
          browser: {
            implemented: out.implemented,
            message: out.userMessage,
            session: out.session,
          },
        };
      }
      case "space.create": {
        const name =
          (typeof block.payload.name === "string" && block.payload.name.trim()) ||
          (typeof block.title === "string" && block.title.trim()) ||
          "";
        if (!name) return { ok: false, message: "space.create_missing_name" };
        const meta = await store.createSpace(name, userId);
        return { ok: true, message: "space_created", detail: meta.id };
      }
      case "space.delete": {
        const sid =
          typeof block.payload.spaceId === "string" ? block.payload.spaceId.trim() : "";
        if (!sid) return { ok: false, message: "space.delete_missing_spaceId" };
        if (sid === spaceId) {
          return { ok: false, message: "space_delete_current_space_via_runner_only" };
        }
        const meta = await store.getSpaceMeta(sid, userId);
        if (!meta) return { ok: false, message: "space_not_found" };
        await store.deleteSpace(sid, userId);
        invalidateBrowserSessionCache(sid, userId);
        const { closePlaywrightForSpace } = await import("../browser/playwright-runtime.js");
        await closePlaywrightForSpace(sid);
        return { ok: true, message: "space_deleted", detail: sid };
      }
      case "snapshot.create": {
        const snap = await createSnapshot(spaceId, "manual", { userId, force: true, label: "execution:snapshot.create" });
        if (!snap) return { ok: false, message: "snapshot_failed" };
        return { ok: true, message: "snapshot_created", detail: snap.meta.id };
      }
      case "cli.tool.run": {
        if (!isCliToolsRunEnabled()) {
          return {
            ok: false,
            message: "cli_tools_disabled",
            detail: "Set AIRIS_CLI_TOOLS=1 and restart the server to run Printing Press CLIs from chat.",
          };
        }
        const p = block.payload as Record<string, unknown>;
        if (typeof p.toolKey === "string" && p.toolKey.trim()) {
          const key = p.toolKey.trim();
          const def = getCliToolByKey(key);
          const base = await runAllowlistedCliTool(key);
          if (base.error === "unknown_tool_key") {
            return { ok: false, message: "cli_unknown_tool_key", detail: key };
          }
          const commandLine = def ? `${def.program} ${def.args.join(" ")}` : key;
          const enriched = await enrichCliRunForSpace(spaceId, userId, base, commandLine);
          return {
            ok: true,
            message: "cli_tool_ran",
            detail: key,
            cliToolRun: {
              ok: enriched.ok,
              exitCode: enriched.exitCode,
              commandLine: enriched.commandLine,
              readableSummary: enriched.readableSummary,
              stdout: enriched.stdout,
              stderr: enriched.stderr,
              durationMs: enriched.durationMs,
            },
          };
        }
        const program = typeof p.program === "string" ? p.program.trim() : "";
        const argsText = typeof p.argsText === "string" ? p.argsText : "";
        const base = await runCustomCliFromText(program, argsText);
        const argv = parseArgsText(argsText);
        const commandLine = argv.length ? `${program} ${argv.join(" ")}` : program;
        const enriched = await enrichCliRunForSpace(spaceId, userId, base, commandLine);
        return {
          ok: true,
          message: "cli_tool_ran",
          detail: program,
          cliToolRun: {
            ok: enriched.ok,
            exitCode: enriched.exitCode,
            commandLine: enriched.commandLine,
            readableSummary: enriched.readableSummary,
            stdout: enriched.stdout,
            stderr: enriched.stderr,
            durationMs: enriched.durationMs,
          },
        };
      }
      case "export.pdf": {
        const parsed = ExportPdfPayloadSchema.safeParse(block.payload);
        if (!parsed.success) {
          return { ok: false, message: "invalid_export_pdf", detail: parsed.error.message.slice(0, 280) };
        }
        try {
          assertExportPdfPayloadSize(parsed.data);
          assertPdfChartEmbedBudget(parsed.data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, message: "invalid_export_pdf", detail: msg.slice(0, 240) };
        }
        const exportId = uuid();
        const filename = sanitizePdfFilename(parsed.data.filename, parsed.data.documentTitle);
        await ensureDir(spaceExportsDir(spaceId, userId));
        const outPath = spaceExportPdfPath(spaceId, exportId, userId);
        const buf = await renderPdfBuffer(parsed.data, {
          resolveChartEmbed: async (widgetId: string) => {
            try {
              const w = await store.getWidget(spaceId, widgetId, userId);
              if (!w) {
                return { ok: false as const, message: "No widget with this id in this workspace." };
              }
              let png: Buffer;
              if (w.kind === "chart-panel") {
                png = await renderChartPanelToPng(w.data);
              } else if (w.kind === "metric-grid") {
                png = await renderMetricGridToPng(w.data);
              } else if (w.kind === "comparison-panel") {
                png = await renderComparisonPanelToPng(w.data);
              } else {
                return {
                  ok: false as const,
                  message: `Raster embed supports chart-panel, metric-grid, and comparison-panel only (got ${w.kind}). Omit chartWidgetId or use one of those ids.`,
                };
              }
              const cap = typeof w.title === "string" && w.title.trim() ? w.title.trim() : undefined;
              return { ok: true as const, png, caption: cap };
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              return { ok: false as const, message: msg.slice(0, 400) };
            }
          },
        });
        await fs.writeFile(outPath, buf);
        return {
          ok: true,
          message: "pdf_exported",
          detail: exportId,
          pdfExport: { exportId, filename },
        };
      }
      case "workflow.run": {
        type WorkflowLog = Pick<FastifyBaseLogger, "info" | "warn">;
        const execLog: WorkflowLog = log ?? { info: () => {}, warn: () => {} };
        try {
          const parsed = WorkflowRunPayloadSchema.safeParse(block.payload);
          if (!parsed.success) {
            return {
              ok: false,
              message: "dispatch_error",
              detail: parsed.error.issues
                .map((i: ZodIssue) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; "),
            };
          }
          const payload = parsed.data;
          switch (payload.name) {
            case "lead-finder": {
              const mapsQuery = composeLeadFinderMapsQuery(payload.query, payload.location);
              execLog.info(
                { spaceId, name: payload.name, query: mapsQuery, maxResults: payload.maxResults },
                "workflow.run start",
              );
              const out = await runLeadFinderForSpace({
                spaceId,
                userId,
                mapsQuery,
                audit: true,
                maxResults: payload.maxResults,
                log: execLog,
              });
              if (!out.ok) {
                return { ok: false, message: "dispatch_error", detail: out.message };
              }
              if (out.businessCount === 0) {
                execLog.warn({ spaceId, reason: "empty", businessCount: 0 }, "workflow.run smoke");
              }
              const avgStr = out.avgBadness == null ? "n/a" : String(out.avgBadness);
              execLog.info(
                {
                  spaceId,
                  name: payload.name,
                  query: mapsQuery,
                  durationMs: out.durationMs,
                  widgetId: out.widgetId,
                  businessCount: out.businessCount,
                },
                "workflow.run complete",
              );
              return {
                ok: true,
                message: `Lead-finder created widget ${out.widgetId} with ${out.businessCount} businesses (avg badness ${avgStr}).`,
                workflowRun: {
                  widgetId: out.widgetId,
                  kind: "lead-finder",
                  businessCount: out.businessCount,
                  avgBadness: out.avgBadness,
                },
              };
            }
            default:
              return {
                ok: false,
                message: "dispatch_error",
                detail: `unknown_workflow_name: ${String(payload.name)}`,
              };
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, message: "dispatch_error", detail: msg };
        }
      }
      default:
        return { ok: false, message: "unknown_type" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: "dispatch_error", detail: msg };
  }
}
