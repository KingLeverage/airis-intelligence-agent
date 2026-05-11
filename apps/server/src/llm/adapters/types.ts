import type { ChatMessage } from "@airis/shared";

/** Inputs for a single completion (transient prompt is built per request, not stored in chat). */
export type ModelCompletionContext = {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  modelId: string;
};

export interface ModelCompletionAdapter {
  complete(ctx: ModelCompletionContext): Promise<string>;
}
