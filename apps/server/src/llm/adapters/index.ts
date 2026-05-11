import { MockModelAdapter } from "./mock-adapter.js";
import { RuntimeModelAdapter } from "./provider-adapter.js";
import type { ModelCompletionAdapter } from "./types.js";
import type { LlmRuntime } from "../resolve-llm-runtime.js";

export type { ModelCompletionAdapter, ModelCompletionContext } from "./types.js";
export { MockModelAdapter, mockModelRawText } from "./mock-adapter.js";
export { RuntimeModelAdapter } from "./provider-adapter.js";

export function createModelAdapter(runtime: LlmRuntime): ModelCompletionAdapter {
  if (runtime.kind === "mock") return new MockModelAdapter();
  return new RuntimeModelAdapter(runtime);
}
