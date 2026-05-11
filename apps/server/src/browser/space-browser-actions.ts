import type { BrowserSession, ParsedExecutionBlock } from "@airis/shared";
import { z } from "zod";
import { dispatchBrowserExecution } from "./browser-action-dispatcher.js";
import { DEFAULT_USER_ID } from "../config.js";

export const BrowserActionRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), targetId: z.string().min(1) }),
  z.object({ type: z.literal("type"), targetId: z.string().min(1), text: z.string() }),
  z.object({ type: z.literal("scroll"), amount: z.number() }),
  z.object({ type: z.literal("back") }),
]);

export type BrowserActionRequest = z.infer<typeof BrowserActionRequestSchema>;

export type BrowserActionResult = {
  implemented: boolean;
  message: string;
};

export async function applyBrowserActionRequest(
  spaceId: string,
  body: BrowserActionRequest,
  userId: string = DEFAULT_USER_ID,
): Promise<{ session: BrowserSession; result: BrowserActionResult }> {
  let block: ParsedExecutionBlock;
  switch (body.type) {
    case "back":
      block = { type: "browser.back", payload: {} };
      break;
    case "click":
      block = { type: "browser.click", targetId: body.targetId, payload: {} };
      break;
    case "type":
      block = {
        type: "browser.type",
        targetId: body.targetId,
        text: body.text,
        payload: {},
      };
      break;
    case "scroll":
      block = { type: "browser.scroll", payload: { amount: body.amount } };
      break;
  }

  const out = await dispatchBrowserExecution(block, spaceId, userId);
  return {
    session: out.session,
    result: { implemented: out.implemented, message: out.userMessage },
  };
}
