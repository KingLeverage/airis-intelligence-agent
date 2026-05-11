import { z } from "zod";

export const ChatRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

const ChatMessageFieldsSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
  role: ChatRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
  executionId: z.string().uuid().optional(),
});

export const ChatMessageSchema = z.preprocess((val) => {
  if (val && typeof val === "object" && val !== null) {
    const o = val as Record<string, unknown>;
    if (typeof o.executionRecordId === "string" && o.executionId == null) {
      return { ...o, executionId: o.executionRecordId };
    }
  }
  return val;
}, ChatMessageFieldsSchema);

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
