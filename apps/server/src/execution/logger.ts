import path from "node:path";
import { v4 as uuid } from "uuid";
import type { ExecutionRecord } from "@airis/shared";
import { atomicWriteJson } from "../persistence/fs-utils.js";
import { executionsDir } from "../persistence/paths.js";
import { DEFAULT_USER_ID } from "../config.js";

export async function writeExecutionRecord(
  record: Omit<ExecutionRecord, "id" | "createdAt" | "schemaVersion"> & {
    id?: string;
    createdAt?: string;
    schemaVersion?: 2;
  },
  userId: string = DEFAULT_USER_ID,
): Promise<ExecutionRecord> {
  const id = record.id ?? uuid();
  const createdAt = record.createdAt ?? new Date().toISOString();
  const full: ExecutionRecord = {
    schemaVersion: 2,
    id,
    spaceId: record.spaceId,
    createdAt,
    rawResponse: record.rawResponse,
    assistantText: record.assistantText,
    parsedBlock: record.parsedBlock,
    parsedBlocks: record.parsedBlocks,
    status: record.status,
    errorMessage: record.errorMessage,
    durationMs: record.durationMs,
    createdWidgetId: record.createdWidgetId,
    createdWidgetIds: record.createdWidgetIds,
    browserDispatch: record.browserDispatch,
    activeSkillIds: record.activeSkillIds,
    skillPromptMetrics: record.skillPromptMetrics,
    pdfExports: record.pdfExports,
    imageExports: record.imageExports,
  };
  const ts = createdAt.replace(/[:.]/g, "-");
  const file = path.join(executionsDir(record.spaceId, userId), `${ts}-${id}.json`);
  await atomicWriteJson(file, full);
  return full;
}
