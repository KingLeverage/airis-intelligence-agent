import type { ParsedExecutionBlock } from "@airis/shared";
import {
  ExportPdfPayloadSchema,
  isChatPhaseExecutionType,
  WidgetKindSchema,
  assertExportPdfPayloadSize,
  assertPdfChartEmbedBudget,
  expandDashboardRecipe,
  parseWidgetPayload,
  WorkspaceComposePayloadSchema,
  WorkflowRunPayloadSchema,
} from "@airis/shared";
import { normalizeHttpUrl } from "../browser/url-utils.js";
import { resolveExecutionTargetId } from "./target-id.js";
import { isCustomCliProgram } from "../services/cli-tools/parse-cli-args.js";

function validateWidgetCreate(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const kind = block.widgetKind;
  if (!kind) {
    return { ok: false, message: "widget.create_missing_kind" };
  }
  const parsedKind = WidgetKindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return { ok: false, message: `unsupported_widget_kind:${kind}` };
  }
  if (block.targetSpace != null && block.targetSpace !== "current") {
    return { ok: false, message: "targetSpace_must_be_current" };
  }
  try {
    parseWidgetPayload(parsedKind.data, block.payload as Record<string, unknown>);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `invalid_widget_payload:${msg.slice(0, 240)}` };
  }
  return { ok: true, block: { ...block, targetSpace: "current" } };
}

function validateWorkspaceCompose(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const parsed = WorkspaceComposePayloadSchema.safeParse(block.payload);
  if (!parsed.success) {
    return { ok: false, message: `invalid_compose:${parsed.error.message.slice(0, 280)}` };
  }
  try {
    if (parsed.data.recipe != null) {
      for (const b of expandDashboardRecipe(parsed.data.recipe)) {
        parseWidgetPayload(b.kind, b.payload as Record<string, unknown>);
      }
    } else {
      for (const w of parsed.data.widgets!) {
        parseWidgetPayload(w.widgetKind, w.payload as Record<string, unknown>);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `invalid_compose_payload:${msg.slice(0, 240)}` };
  }
  if (block.targetSpace != null && block.targetSpace !== "current") {
    return { ok: false, message: "targetSpace_must_be_current" };
  }
  return { ok: true, block: { ...block, targetSpace: "current" } };
}

function validateWidgetDelete(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const payload =
    block.payload && typeof block.payload === "object"
      ? (block.payload as Record<string, unknown>)
      : null;
  const wid =
    block.widgetId ?? (payload && typeof payload.widgetId === "string" ? payload.widgetId : undefined);
  if (typeof wid !== "string" || !wid.trim()) {
    return { ok: false, message: "widget.delete_missing_id" };
  }
  if (block.targetSpace != null && block.targetSpace !== "current") {
    return { ok: false, message: "targetSpace_must_be_current" };
  }
  return { ok: true, block: { ...block, widgetId: wid.trim(), targetSpace: "current" } };
}

function validateBrowserNavigate(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const url = block.url ?? (typeof block.payload.url === "string" ? block.payload.url : "");
  if (!url.trim()) {
    return { ok: false, message: "browser.navigate_missing_url" };
  }
  try {
    normalizeHttpUrl(url.trim());
  } catch {
    return { ok: false, message: "browser.navigate_invalid_url" };
  }
  return { ok: true, block: { ...block, targetSpace: "current" } };
}

function validateBrowserClick(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const tid = resolveExecutionTargetId(block);
  if (tid == null) {
    return { ok: false, message: "browser.click_missing_target" };
  }
  return { ok: true, block: { ...block, targetId: tid, targetSpace: "current" } };
}

function validateBrowserType(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const tid = resolveExecutionTargetId(block);
  const text =
    block.text ?? (typeof block.payload.text === "string" ? block.payload.text : undefined);
  if (tid == null || text == null) {
    return { ok: false, message: "browser.type_missing_fields" };
  }
  return { ok: true, block: { ...block, targetId: tid, text, targetSpace: "current" } };
}

function validateSpaceCreate(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const name =
    (typeof block.payload.name === "string" && block.payload.name.trim()) ||
    (typeof block.title === "string" && block.title.trim()) ||
    "";
  if (!name) return { ok: false, message: "space.create_missing_name" };
  return {
    ok: true,
    block: {
      ...block,
      targetSpace: "current",
      title: name,
      payload: { ...block.payload, name },
    },
  };
}

function validateExportPdf(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const p = ExportPdfPayloadSchema.safeParse(block.payload);
  if (!p.success) {
    return { ok: false, message: `invalid_export_pdf:${p.error.message.slice(0, 240)}` };
  }
  try {
    assertExportPdfPayloadSize(p.data);
    assertPdfChartEmbedBudget(p.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `invalid_export_pdf:${msg.slice(0, 240)}` };
  }
  return { ok: true, block: { ...block, targetSpace: "current", payload: p.data as Record<string, unknown> } };
}

function validateSpaceDelete(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const sid =
    typeof block.payload.spaceId === "string" ? block.payload.spaceId.trim() : "";
  if (!sid) return { ok: false, message: "space.delete_missing_spaceId" };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(sid)) return { ok: false, message: "space.delete_invalid_spaceId" };
  return { ok: true, block: { ...block, targetSpace: "current", payload: { ...block.payload, spaceId: sid } } };
}

function validateBrowserEvaluate(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const raw =
    (typeof block.payload.script === "string" ? block.payload.script : null) ??
    (typeof block.payload.code === "string" ? block.payload.code : null) ??
    (typeof block.text === "string" ? block.text : null);
  if (raw == null || !String(raw).trim()) {
    return { ok: false, message: "browser.evaluate_missing_script" };
  }
  const script = String(raw);
  if (script.length > 24_000) {
    return { ok: false, message: "browser.evaluate_script_too_long" };
  }
  return {
    ok: true,
    block: {
      ...block,
      targetSpace: "current",
      payload: { ...block.payload, script },
    },
  };
}

function validateCliToolRun(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const p =
    block.payload && typeof block.payload === "object"
      ? (block.payload as Record<string, unknown>)
      : null;
  if (!p) return { ok: false, message: "cli.tool.run_missing_payload" };
  const toolKey = typeof p.toolKey === "string" ? p.toolKey.trim() : "";
  if (toolKey) {
    if (toolKey.length > 120) return { ok: false, message: "cli.tool.run_toolKey_too_long" };
    return { ok: true, block: { ...block, targetSpace: "current", payload: { toolKey } } };
  }
  const program = typeof p.program === "string" ? p.program.trim() : "";
  const argsText = typeof p.argsText === "string" ? p.argsText : "";
  if (!program || !isCustomCliProgram(program)) {
    return { ok: false, message: "cli.tool.run_need_toolKey_or_custom_program" };
  }
  if (argsText.length > 4000) return { ok: false, message: "cli.tool.run_argsText_too_long" };
  return {
    ok: true,
    block: { ...block, targetSpace: "current", payload: { program, argsText } },
  };
}

function validateWorkflowRun(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  if (block.targetSpace != null && block.targetSpace !== "current") {
    return { ok: false, message: "targetSpace_must_be_current" };
  }
  const p = WorkflowRunPayloadSchema.safeParse(block.payload);
  if (!p.success) {
    return { ok: false, message: `invalid_workflow_payload:${p.error.message.slice(0, 280)}` };
  }
  return {
    ok: true,
    block: {
      ...block,
      targetSpace: "current",
      payload: { ...p.data } as Record<string, unknown>,
    },
  };
}

function validateBrowserScroll(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  const raw = block.payload.amount;
  const amount =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(amount)) {
    return { ok: false, message: "browser.scroll_missing_amount" };
  }
  return {
    ok: true,
    block: { ...block, targetSpace: "current", payload: { ...block.payload, amount } },
  };
}

/**
 * Chat-to-execution: widget creation / compose / mutations plus browser workspace actions.
 * Other execution types (layout, snapshot, …) stay off this path until explicitly enabled.
 */
export function validateChatPhaseExecution(
  block: ParsedExecutionBlock,
): { ok: true; block: ParsedExecutionBlock } | { ok: false; message: string } {
  if (!isChatPhaseExecutionType(block.type)) {
    return { ok: false, message: `unsupported_execution_in_chat_phase:${block.type}` };
  }
  switch (block.type) {
    case "widget.create":
      return validateWidgetCreate(block);
    case "widget.createMany":
    case "workspace.compose":
      return validateWorkspaceCompose(block);
    case "widget.move":
    case "widget.resize":
    case "widget.update":
      return { ok: true, block: { ...block, targetSpace: "current" } };
    case "widget.delete":
      return validateWidgetDelete(block);
    case "browser.navigate":
      return validateBrowserNavigate(block);
    case "browser.click":
      return validateBrowserClick(block);
    case "browser.type":
      return validateBrowserType(block);
    case "browser.scroll":
      return validateBrowserScroll(block);
    case "browser.back":
      return { ok: true, block: { ...block, targetSpace: "current" } };
    case "browser.evaluate":
      return validateBrowserEvaluate(block);
    case "space.create":
      return validateSpaceCreate(block);
    case "space.delete":
      return validateSpaceDelete(block);
    case "export.pdf":
      return validateExportPdf(block);
    case "cli.tool.run":
      return validateCliToolRun(block);
    case "workflow.run":
      return validateWorkflowRun(block);
  }
  const _exhaustive: never = block.type;
  return _exhaustive;
}
