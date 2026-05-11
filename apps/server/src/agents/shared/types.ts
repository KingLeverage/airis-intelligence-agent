import type { AgentStreamRequest, WorkspaceSnapshot } from "@airis/shared";
import type { LlmRuntime } from "../../llm/resolve-llm-runtime.js";

export type EmbeddedAgentContext = {
  request: AgentStreamRequest;
  runtime: LlmRuntime;
  modelId: string;
};

export type SpecialistParams = EmbeddedAgentContext & {
  workspaceSnapshot: WorkspaceSnapshot;
};
