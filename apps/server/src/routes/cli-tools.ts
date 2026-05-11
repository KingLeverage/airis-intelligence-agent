import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as store from "../persistence/space-store.js";
import { DEFAULT_USER_ID, isCliToolsRunEnabled } from "../config.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import { getCliToolByKey, listCliToolCatalogPublic } from "../services/cli-tools/cli-tool-registry.js";
import { enrichCliRunForSpace } from "../services/cli-tools/enrich-cli-run.js";
import { CUSTOM_CLI_PROGRAMS, isCustomCliProgram, parseArgsText, type CustomCliProgram } from "../services/cli-tools/parse-cli-args.js";
import { runAllowlistedCliTool, runCustomCliFromText } from "../services/cli-tools/run-cli-tool.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RunBodySchema = z.union([
  z.object({ toolKey: z.string().min(1).max(120) }).strict(),
  z
    .object({
      program: z
        .string()
        .refine((s): s is CustomCliProgram => isCustomCliProgram(s), { message: "invalid_cli_program" }),
      argsText: z.string().max(4000),
    })
    .strict(),
]);

export async function registerCliToolRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/spaces/:spaceId/cli-tools/catalog", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if (!UUID_RE.test(spaceId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));
    return reply.send(
      apiOk({
        tools: listCliToolCatalogPublic(),
        runsEnabled: isCliToolsRunEnabled(),
        customPrograms: [...CUSTOM_CLI_PROGRAMS],
      }),
    );
  });

  app.post("/api/spaces/:spaceId/cli-tools/run", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if (!UUID_RE.test(spaceId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    if (!isCliToolsRunEnabled()) {
      return reply.code(403).send(apiErr("forbidden", "CLI runs disabled (set AIRIS_CLI_TOOLS=1 to enable)"));
    }

    const parsed = RunBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(apiErr("bad_request", parsed.error.message));
    }

    const body = parsed.data;

    if ("toolKey" in body) {
      const key = body.toolKey.trim();
      const def = getCliToolByKey(key);
      const base = await runAllowlistedCliTool(key);
      if (base.error === "unknown_tool_key") {
        return reply.code(400).send(apiErr("bad_request", "Unknown toolKey"));
      }
      const commandLine = def ? `${def.program} ${def.args.join(" ")}` : key;
      return reply.send(apiOk(await enrichCliRunForSpace(spaceId, DEFAULT_USER_ID, base, commandLine)));
    }

    const base = await runCustomCliFromText(body.program, body.argsText);
    const argv = parseArgsText(body.argsText);
    const commandLine = argv.length ? `${body.program} ${argv.join(" ")}` : body.program;
    return reply.send(apiOk(await enrichCliRunForSpace(spaceId, DEFAULT_USER_ID, base, commandLine)));
  });
}
