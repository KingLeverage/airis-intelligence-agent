import * as store from "../../persistence/space-store.js";
import { buildReadableSummary, resolveSummaryModelId } from "./build-readable-summary.js";
import type { CliToolRunResult } from "./run-cli-tool.js";

/** Shared enrichment for HTTP `/cli-tools/run` and chat `cli.tool.run` execution. */
export async function enrichCliRunForSpace(
  spaceId: string,
  userId: string,
  result: CliToolRunResult,
  commandLine: string,
): Promise<CliToolRunResult & { commandLine: string; readableSummary: string }> {
  const settings = await store.readSettings(spaceId, userId);
  const modelId = resolveSummaryModelId(settings.defaultModelId);
  const readableSummary = await buildReadableSummary({
    userId,
    modelId,
    commandLine,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  return {
    ...result,
    commandLine,
    readableSummary,
  };
}
