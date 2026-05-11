import {
  ExecutionRecordSchema,
  LegacyExecutionRecordSchema,
  type ExecutionRecord,
} from "@airis/shared";

/** Accept v2 JSON or legacy execution log files. */
export function coerceExecutionRecord(raw: unknown): ExecutionRecord | null {
  const v2 = ExecutionRecordSchema.safeParse(raw);
  if (v2.success) return v2.data;

  const leg = LegacyExecutionRecordSchema.safeParse(raw);
  if (!leg.success) return null;

  const l = leg.data;
  const anyResults = l.results.length > 0;
  const allOk = l.results.every((r) => r.ok);
  const errDetail = l.results
    .filter((r) => !r.ok)
    .map((r) => r.detail ?? r.message)
    .join("; ");

  const status = !anyResults ? "parsed" : allOk ? "applied" : "failed";

  return {
    schemaVersion: 2,
    id: l.id,
    spaceId: l.spaceId,
    createdAt: l.createdAt,
    rawResponse: l.rawAssistantExcerpt ?? "",
    assistantText: "",
    status,
    errorMessage: status === "failed" ? errDetail || "legacy_execution_failed" : undefined,
    durationMs: l.durationMs,
  };
}
