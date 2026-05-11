import type { ExecutionType } from "../protocol/execution.js";
import { ExecutionTypeSchema } from "../protocol/execution.js";

/** Derived from `ExecutionTypeSchema` — keep in sync with `<<<EXECUTION` dispatcher. */
export const EXECUTION_TYPES = Object.values(ExecutionTypeSchema.enum) as ExecutionType[];

export type { ExecutionType };
