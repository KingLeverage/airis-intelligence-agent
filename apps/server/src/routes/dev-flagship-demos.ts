import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_USER_ID } from "../config.js";
import { reapplyFlagshipDemoRecipes } from "../persistence/seed-demo-spaces.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const Body = z.object({
  templateIds: z.array(z.string().min(1)).optional(),
  force: z.boolean().optional(),
});

/**
 * Registered only when `AIRIS_ALLOW_FLAGSHIP_DEMO_RECIPE_REFRESH=1` (see `server.ts`).
 * Rewrites **widgets only** for seeded Crypto / Research demos.
 */
export async function registerDevFlagshipDemoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/dev/reapply-flagship-demo-recipes", async (req, reply) => {
    const p = Body.safeParse(req.body ?? {});
    if (!p.success) return reply.code(400).send(apiErr("invalid_body", p.error.message));
    const results = await reapplyFlagshipDemoRecipes(DEFAULT_USER_ID, p.data);
    return reply.send(apiOk({ results }));
  });
}
