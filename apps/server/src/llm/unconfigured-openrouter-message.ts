/** Shown when the UI model id is OpenRouter but the operator profile has no API key. */
export function unconfiguredOpenRouterMessage(requestedModelId: string): string {
  const label = requestedModelId.trim() || "openrouter";
  return `**OpenRouter is not configured yet.** You selected \`${label}\`, but AIRIS has **no OpenRouter API key** stored for this profile, so the server cannot call the real model (it used to fall through to offline “mock” replies, which looked like nothing worked).

**What to do**
1. Open **Model & API settings** from the workspace command bar (same place you pick models).
2. Paste an API key from [openrouter.ai/keys](https://openrouter.ai/keys) and save.
3. Send your message again.

**CLI widget:** the **Custom argv** box only accepts **space-separated CLI tokens** (e.g. \`--agent instagram list-reels --query "crude oil" --date-posted last-week\`), not full English sentences — use chat (with a configured model) or type argv like the doctor preset.`;
}
