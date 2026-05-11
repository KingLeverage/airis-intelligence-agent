import { z } from "zod";
import { ChatMessageSchema } from "./chat.js";
import { WorkspaceSnapshotSchema } from "./workspace-snapshot.js";

/** Body for `POST /api/agent/stream` (embedded AIRIS agent widget). */
export const AgentStreamRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  workspaceSnapshot: WorkspaceSnapshotSchema,
  spawnDepth: z
    .number()
    .int()
    .min(0)
    .max(2, { message: "spawnDepth must be at most 2" }),
  conversationHistory: z.array(ChatMessageSchema).default([]),
});

export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;
