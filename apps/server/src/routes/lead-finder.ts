import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { WidgetRecord } from "@airis/shared";
import { DEFAULT_USER_ID } from "../config.js";
import * as store from "../persistence/space-store.js";
import { runLeadFinderForSpace } from "../services/lead-finder-runner.js";
import { apiErr, apiOk } from "../utils/api-response.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RunBody = z.object({
  query: z.string().min(1),
  widgetId: z.string().uuid().optional(),
  waitMs: z.coerce.number().int().min(0).max(30_000).optional(),
  scrollSteps: z.coerce.number().int().min(0).max(20).optional(),
  scrollDelayMs: z.coerce.number().int().min(100).max(5000).optional(),
  audit: z.boolean().optional().default(true),
});

export async function registerLeadFinderRoutes(app: FastifyInstance): Promise<void> {
  /* Widget mutations persist to disk + snapshots; there is no server-side WebSocket/SSE "space changed"
   * broadcast in apps/server. The web app refetches widgets after agent chat (session-store postChat →
   * widgetsStore.load). Callers of this route from custom UI should invoke the same load/refresh after success. */
  app.post("/api/spaces/:spaceId/lead-finder/run", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    if (!UUID_RE.test(spaceId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space id"));
    }
    const parsed = RunBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(apiErr("invalid_body", parsed.error.message));

    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const { query, widgetId, waitMs, scrollSteps, scrollDelayMs, audit } = parsed.data;

    const out = await runLeadFinderForSpace({
      spaceId,
      userId: DEFAULT_USER_ID,
      mapsQuery: query,
      widgetId,
      waitMs,
      scrollSteps,
      scrollDelayMs,
      audit,
      log: req.log,
    });

    if (!out.ok) {
      if (out.code === "invalid_url") {
        return reply.code(400).send(apiErr("invalid_url", out.message));
      }
      if (out.code === "not_found") {
        return reply.code(404).send(apiErr("not_found", out.message));
      }
      if (out.code === "invalid_body") {
        return reply.code(400).send(apiErr(out.code, out.message));
      }
      if (out.code === "no_browser_view") {
        return reply.code(503).send(apiErr("no_browser_view", out.message));
      }
      return reply.code(502).send(apiErr("scrape_failed", out.message));
    }

    const w = await store.getWidget(spaceId, out.widgetId, DEFAULT_USER_ID);
    if (!w) return reply.code(404).send(apiErr("not_found", "Widget not found after create"));
    return reply.send(apiOk({ widgetId: out.widgetId, payload: w.data }));
  });

  app.get("/api/spaces/:spaceId/lead-finder/:widgetId/csv", async (req, reply) => {
    const { spaceId, widgetId } = req.params as { spaceId: string; widgetId: string };
    if (!UUID_RE.test(spaceId) || !UUID_RE.test(widgetId)) {
      return reply.code(400).send(apiErr("bad_request", "Invalid space or widget id"));
    }
    const meta = await store.getSpaceMeta(spaceId, DEFAULT_USER_ID);
    if (!meta) return reply.code(404).send(apiErr("not_found", "Space not found"));

    const w = await store.getWidget(spaceId, widgetId, DEFAULT_USER_ID);
    if (!w || w.kind !== "lead-finder") {
      return reply.code(404).send(apiErr("widget_not_found", widgetId));
    }
    const data = (w as WidgetRecord).data as Record<string, unknown>;
    const businesses = Array.isArray(data?.businesses) ? data.businesses : [];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "rank",
      "name",
      "phone",
      "website",
      "rating",
      "reviewCount",
      "category",
      "address",
      "hours",
      "badnessScore",
      "techStack",
      "topSignals",
      "reviewSnippet",
    ];
    const rows = businesses.map((b: unknown, i: number) => {
      const row = b as Record<string, unknown>;
      const audit = row.audit as Record<string, unknown> | undefined;
      const signals = Array.isArray(audit?.signals)
        ? (audit?.signals as { id?: string }[])
        : [];
      const tech = Array.isArray(audit?.techStack) ? (audit?.techStack as string[]) : [];
      return [
        i + 1,
        row.name ?? "",
        row.phone ?? "",
        row.website ?? "",
        row.rating ?? "",
        row.reviewCount ?? "",
        row.category ?? "",
        row.address ?? "",
        row.hours ?? "",
        audit?.badnessScore ?? "",
        tech.join("|"),
        signals.map((s) => s.id).join("|"),
        row.reviewSnippet ?? "",
      ]
        .map(escape)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\r\n");

    const safeQuery = (data?.query ?? "leads").toString().replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="leads-${safeQuery}.csv"`)
      .send(csv);
  });
}
