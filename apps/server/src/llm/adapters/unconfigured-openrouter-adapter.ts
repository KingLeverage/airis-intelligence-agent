import type { ModelCompletionAdapter, ModelCompletionContext } from "./types.js";
import { unconfiguredOpenRouterMessage } from "../unconfigured-openrouter-message.js";

export class UnconfiguredOpenRouterAdapter implements ModelCompletionAdapter {
  constructor(private readonly requestedModelId: string) {}

  async complete(_ctx: ModelCompletionContext): Promise<string> {
    return unconfiguredOpenRouterMessage(this.requestedModelId);
  }
}
