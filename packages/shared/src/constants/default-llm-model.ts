/** OpenRouter slug only (no `openrouter:` prefix). */
export const DEFAULT_OPENROUTER_MODEL_SLUG = "nvidia/llama-3.3-nemotron-super-49b-v1.5" as const;

/** Session / workspace `defaultModelId` and server default when using the product OpenRouter model. */
export const DEFAULT_LLM_MODEL_ID = `openrouter:${DEFAULT_OPENROUTER_MODEL_SLUG}` as const;
