import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
