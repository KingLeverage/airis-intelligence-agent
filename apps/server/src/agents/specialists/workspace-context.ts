import { streamLlmResponse } from "../../llm/stream.js";
import type { SpecialistParams } from "../shared/types.js";

function formatSnapshotSummary(snapshot: SpecialistParams["workspaceSnapshot"]): string {
  const lines = snapshot.widgets.map((w) => {
    const bits = [`- id=${w.id} kind=${w.kind}${w.title ? ` title="${w.title}"` : ""}`];
    if (w.summary) bits.push(`  summary: ${w.summary}`);
    return bits.join("\n");
  });
  return [`spaceId=${snapshot.spaceId}`, ...lines].join("\n");
}

export async function* streamWorkspaceContext(
  params: SpecialistParams & { question: string },
): AsyncGenerator<string> {
  const { question, request, runtime, modelId, workspaceSnapshot } = params;

  const system = `You are the AIRIS **workspace context** specialist. Answer questions using ONLY the workspace snapshot below. If the snapshot does not contain enough detail, say what is missing. Do not invent widgets that are not listed.

## Workspace snapshot
${formatSnapshotSummary(workspaceSnapshot)}`;

  if (runtime.kind === "mock") {
    yield `[workspace-context • mock] canvas widgets: ${workspaceSnapshot.widgets.length}. Q: ${question.slice(0, 200)}`;
    return;
  }

  for await (const chunk of streamLlmResponse({
    history: request.conversationHistory,
    userMessage: question,
    modelId,
    system,
    runtime,
  })) {
    yield chunk;
  }
}
