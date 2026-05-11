/**
 * Operator Space–style service facades. Routes may gradually import from here
 * instead of deep `persistence/` / `execution/` paths.
 */
export * as spaces from "./spaces/index.js";
export * as widgets from "./widgets/index.js";
export * as chat from "./chat/index.js";
export * as executions from "./executions/index.js";
export * as browser from "./browser/index.js";
export * as llm from "./llm/index.js";
export * as snapshots from "./snapshots/index.js";
export * as recovery from "./recovery/index.js";
