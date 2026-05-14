import { v4 as uuid } from "uuid";
import type {
  BrowserSession,
  ChatMessage,
  ExecutionRecord,
  ParsedExecutionBlock,
  SkillPromptMetrics,
} from "@airis/shared";
import type { FastifyBaseLogger } from "fastify";
import * as store from "../persistence/space-store.js";
import * as browserSession from "../browser/session-store.js";
import { parseModelResponseMulti } from "./response-parser.js";
import { validateChatPhaseExecution } from "./validator.js";
import { dispatchExecution, type DispatchResult } from "./dispatcher.js";
import { writeExecutionRecord } from "./logger.js";
import { modelIdUsesOpenRouterImageOutput } from "../llm/openai-compatible-chat.js";
import { saveDataUrlImagesToSpaceExports } from "../services/exports/save-data-url-images-to-exports.js";
import {
  appendImageExportMarkdownFootnote,
  createHtmlCardWidgetsForImageExports,
} from "../services/exports/provision-chat-image-exports.js";

export type ChatTurnDispatchResult = {
  ok: boolean;
  message: string;
  detail?: string;
  browser?: { implemented: boolean; message: string };
};

export type FinalizeChatResult = {
  assistantText: string;
  assistantMsg: ChatMessage;
  execRecord: ExecutionRecord;
  /** Client/UI mirror of execution outcome */
  results: ChatTurnDispatchResult[];
  /** Summarizes the executed step when applicable */
  executionResult?: { implemented: boolean; message: string };
  /** True when this turn removed the chat space after persisting the reply (avoid re-listing widgets). */
  spaceDeletedAfterTurn?: boolean;
};

function toResults(record: ExecutionRecord): ChatTurnDispatchResult[] {
  const ok = record.status === "applied";
  const row: ChatTurnDispatchResult = {
    ok,
    message: record.status,
    detail: record.errorMessage,
  };
  if (record.browserDispatch) {
    row.browser = record.browserDispatch;
  }
  return [row];
}

export async function finalizeAssistantResponse(
  spaceId: string,
  assistantRaw: string,
  userId: string,
  t0: number,
  opts?: {
    activeSkillIds?: string[];
    skillPromptMetrics?: SkillPromptMetrics;
    modelId?: string;
    log?: FastifyBaseLogger;
  },
): Promise<FinalizeChatResult> {
  const parsed = parseModelResponseMulti(assistantRaw);
  let assistantTextOut = parsed.assistantText;
  const storedBlocks: ParsedExecutionBlock[] | undefined =
    parsed.parseError || parsed.blocks.length === 0 ? undefined : parsed.blocks;
  const storedBlock: ParsedExecutionBlock | undefined = storedBlocks?.[0];

  let status: ExecutionRecord["status"];
  let errorMessage: string | undefined;
  let createdWidgetId: string | undefined;
  let createdWidgetIds: string[] | undefined;
  let browserDispatch: ExecutionRecord["browserDispatch"];
  let executionResult: { implemented: boolean; message: string } | undefined;
  let deferredSpaceDeleteId: string | undefined;
  const pdfExports: { exportId: string; filename: string }[] = [];
  let imageExports: { exportId: string; filename: string }[] = [];

  if (parsed.parseError) {
    status = "failed";
    errorMessage = parsed.parseError;
  } else if (parsed.blocks.length === 0) {
    status = "parsed";
    // The model produced no execution block. If it also sounded like it
    // promised to execute something (with a numeric target, to avoid
    // matching conversational filler like "I'll find that"), surface a
    // soft prompt to the user. Only fires when nothing actually ran.
    const PROMISED_EXECUTION =
      /(?:^|[.!?]\s+)(I'?ll\s+(?:search|find|scrape|look\s+up)\s+(?:for\s+)?\d+|let me\s+(?:search|find|scrape)\s+(?:for\s+)?\d+|executing the (?:search|workflow|lead[- ]finder))/i;
    if (PROMISED_EXECUTION.test(assistantRaw)) {
      opts?.log?.warn(
        { assistantTextPrefix: assistantRaw.slice(0, 200) },
        "chat-runner.promised-but-no-block",
      );
      const softNote =
        '\n\n⚠️ _Internal note: I said I would run a workflow but didn\'t emit one. Try rephrasing — e.g. "find me 20 plumbers in Chicago"._';
      assistantTextOut = assistantTextOut.trim()
        ? `${assistantTextOut.trim()}${softNote}`
        : softNote;
    }
  } else {
    const allCreatedIds: string[] = [];
    const kindLabels: string[] = [];
    let lastBrowser: DispatchResult["browser"];
    let failedDetail: string | undefined;
    let failedMessage: string | undefined;
    let rejectedMessage: string | undefined;
    const spaceNotes: string[] = [];
    const cliRunSummaries: string[] = [];

    let lastFailedDispatchBlock: ParsedExecutionBlock | undefined;
    for (const block of parsed.blocks) {
      const v = validateChatPhaseExecution(block);
      if (!v.ok) {
        rejectedMessage = v.message;
        break;
      }
      if (v.block.type === "space.delete") {
        const sid =
          typeof v.block.payload.spaceId === "string" ? v.block.payload.spaceId.trim() : "";
        if (sid === spaceId) {
          deferredSpaceDeleteId = sid;
          continue;
        }
      }
      const dispatchResult = await dispatchExecution(v.block, spaceId, userId, opts?.log);
      if (dispatchResult.browser) {
        lastBrowser = dispatchResult.browser;
      }
      if (!dispatchResult.ok) {
        failedMessage = dispatchResult.message;
        failedDetail = dispatchResult.detail;
        lastFailedDispatchBlock = v.block;
        break;
      }
      if (dispatchResult.message === "cli_tool_ran" && dispatchResult.cliToolRun) {
        const r = dispatchResult.cliToolRun;
        const cliStatus = r.exitCode === 0 ? "ok" : `exit ${r.exitCode}`;
        cliRunSummaries.push(`CLI (${cliStatus}) — \`${r.commandLine}\`\n\n${r.readableSummary}`);
        continue;
      }
      if (dispatchResult.message === "widget_created" && dispatchResult.detail) {
        allCreatedIds.push(dispatchResult.detail);
        kindLabels.push(v.block.widgetKind ?? "widget");
      }
      if (dispatchResult.message === "workspace_composed" && dispatchResult.composedWidgetIds?.length) {
        allCreatedIds.push(...dispatchResult.composedWidgetIds);
        if (dispatchResult.composedWidgetKinds?.length) {
          kindLabels.push(...dispatchResult.composedWidgetKinds);
        }
      }
      if (dispatchResult.workflowRun?.widgetId) {
        allCreatedIds.push(dispatchResult.workflowRun.widgetId);
        kindLabels.push(dispatchResult.workflowRun.kind);
      }
      if (dispatchResult.message === "space_created" && dispatchResult.detail) {
        spaceNotes.push(`Created workspace ${dispatchResult.detail}`);
      }
      if (dispatchResult.message === "space_deleted" && dispatchResult.detail) {
        spaceNotes.push(`Deleted workspace ${dispatchResult.detail}`);
      }
      if (dispatchResult.message === "pdf_exported" && dispatchResult.pdfExport) {
        pdfExports.push(dispatchResult.pdfExport);
      }
    }

    if (rejectedMessage) {
      status = "rejected";
      errorMessage = rejectedMessage;
    } else if (failedMessage) {
      status = "failed";
      errorMessage = failedDetail ?? failedMessage;
      if (lastFailedDispatchBlock?.type === "workflow.run") {
        const detail = (failedDetail ?? failedMessage ?? "").trim();
        const human = `⚠️ Lead-finder couldn't run: ${detail || "Unknown error"}. Try opening the Browser panel once in this workspace, then ask again.`;
        assistantTextOut = assistantTextOut.trim() ? `${assistantTextOut.trim()}\n\n${human}` : human;
      }
    } else {
      status = "applied";
      if (allCreatedIds.length > 0) {
        createdWidgetIds = allCreatedIds;
        createdWidgetId = allCreatedIds[0];
      }
      if (lastBrowser) {
        browserDispatch = {
          implemented: lastBrowser.implemented,
          message: lastBrowser.message,
        };
      }
      const summaryParts: string[] = [];
      if (kindLabels.length > 0) {
        const summary =
          kindLabels.length <= 5
            ? kindLabels.join(", ")
            : `${kindLabels.slice(0, 4).join(", ")} +${kindLabels.length - 4} more`;
        summaryParts.push(
          `Workspace: ${summary}${allCreatedIds.length > 1 ? ` (${allCreatedIds.length} widgets)` : ""}`,
        );
      }
      if (pdfExports.length > 0) {
        summaryParts.push(
          pdfExports.length === 1
            ? `PDF ready (${pdfExports[0].filename})`
            : `${pdfExports.length} PDFs ready`,
        );
      }
      if (summaryParts.length > 0) {
        let message = summaryParts.join(" · ");
        if (lastBrowser && kindLabels.length === 0) {
          message = `${message} · ${lastBrowser.message}`;
        }
        executionResult = { implemented: true, message };
      } else if (lastBrowser) {
        executionResult = {
          implemented: true,
          message: lastBrowser.message,
        };
      } else if (spaceNotes.length > 0) {
        executionResult = {
          implemented: true,
          message: spaceNotes.join(" · "),
        };
      } else if (deferredSpaceDeleteId) {
        executionResult = {
          implemented: true,
          message: "Workspace deleted.",
        };
      }
      if (cliRunSummaries.length > 0) {
        const cliText = cliRunSummaries.join("\n\n———\n\n");
        if (executionResult) {
          executionResult = { implemented: true, message: `${executionResult.message}\n\n${cliText}` };
        } else {
          executionResult = { implemented: true, message: cliText };
        }
      }
    }
  }

  if (!parsed.parseError && modelIdUsesOpenRouterImageOutput(opts?.modelId)) {
    imageExports = await saveDataUrlImagesToSpaceExports({
      spaceId,
      userId,
      text: parsed.assistantText,
    });
  }

  let imageExportWidgetIds: string[] = [];
  if (imageExports.length > 0) {
    if (deferredSpaceDeleteId !== spaceId) {
      try {
        imageExportWidgetIds = await createHtmlCardWidgetsForImageExports({
          spaceId,
          userId,
          imageExports,
        });
      } catch {
        imageExportWidgetIds = [];
      }
      if (imageExportWidgetIds.length > 0) {
        createdWidgetIds = [...(createdWidgetIds ?? []), ...imageExportWidgetIds];
        if (!createdWidgetId) createdWidgetId = imageExportWidgetIds[0];
      }
    }
    assistantTextOut = appendImageExportMarkdownFootnote(spaceId, assistantTextOut, imageExports);
  }

  if (imageExports.length > 0) {
    const canvasHint = imageExportWidgetIds.length > 0 ? " · Added to canvas" : "";
    const bit =
      imageExports.length === 1
        ? `Image saved (${imageExports[0].filename})${canvasHint}`
        : `${imageExports.length} images saved${canvasHint}`;
    if (executionResult) {
      executionResult = { implemented: true, message: `${executionResult.message} · ${bit}` };
    } else {
      executionResult = {
        implemented: true,
        message: `${bit}. Download links are in the reply; open **Exports** for the file list.`,
      };
    }
  }

  const execRecord = await writeExecutionRecord(
    {
      spaceId,
      rawResponse: assistantRaw,
      assistantText: assistantTextOut,
      parsedBlock: storedBlock,
      parsedBlocks: storedBlocks,
      status,
      errorMessage,
      durationMs: Date.now() - t0,
      createdWidgetId,
      createdWidgetIds,
      browserDispatch,
      activeSkillIds: opts?.activeSkillIds?.length ? opts.activeSkillIds : undefined,
      skillPromptMetrics: opts?.skillPromptMetrics,
      pdfExports: pdfExports.length > 0 ? pdfExports : undefined,
      imageExports: imageExports.length > 0 ? imageExports : undefined,
    },
    userId,
  );

  const assistantMsg: ChatMessage = {
    id: uuid(),
    spaceId,
    role: "assistant",
    content: assistantTextOut,
    createdAt: new Date().toISOString(),
    executionId: execRecord.id,
  };
  await store.appendChatMessage(assistantMsg, spaceId, userId);

  let spaceDeletedAfterTurn = false;
  if (deferredSpaceDeleteId && status === "applied") {
    await store.deleteSpace(deferredSpaceDeleteId, userId);
    browserSession.invalidateBrowserSessionCache(deferredSpaceDeleteId, userId);
    try {
      const { closePlaywrightForSpace } = await import("../browser/playwright-runtime.js");
      await closePlaywrightForSpace(deferredSpaceDeleteId);
    } catch {
      /* ignore */
    }
    spaceDeletedAfterTurn = true;
  }

  return {
    assistantText: assistantTextOut,
    assistantMsg,
    execRecord,
    results: toResults(execRecord),
    executionResult,
    spaceDeletedAfterTurn: spaceDeletedAfterTurn ? true : undefined,
  };
}

/** Current browser workspace state after a chat turn (for API payloads). */
export async function getBrowserSessionSnapshot(
  spaceId: string,
  userId: string,
): Promise<BrowserSession> {
  return browserSession.getSession(spaceId, userId);
}
