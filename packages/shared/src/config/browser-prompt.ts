/**
 * Include compact browser context in agent system prompts unless disabled.
 * Set `AIRIS_BROWSER_CONTEXT=0` to omit the extra "## Browser Context" section.
 */
export function includeBrowserContextSection(): boolean {
  return process.env.AIRIS_BROWSER_CONTEXT !== "0";
}
