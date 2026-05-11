import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { BrowserPageTranscription } from "@airis/shared";
import * as browserSession from "../browser/session-store.js";
import { transcribeUrl } from "../browser/transcribe.js";
import { normalizeHttpUrl } from "../browser/url-utils.js";
import { buildBrowserPreviewDocument } from "../browser/preview-html.js";
import {
  isPlaywrightBrowserEnabled,
  playwrightScreenshotPng,
} from "../browser/playwright-runtime.js";
import {
  applyBrowserActionRequest,
  BrowserActionRequestSchema,
} from "../browser/space-browser-actions.js";
import { apiErr, apiOk } from "../utils/api-response.js";
import { DEFAULT_USER_ID, isPreviewUnsafeFullPageEnabled } from "../config.js";

const TranscribeBody = z.object({
  url: z.string().min(1),
  mode: z.enum(["mock", "fetch"]).optional(),
});

const NavigateBody = z.object({
  url: z.string().min(1),
  /** `visual` = update session URL for the in-app iframe only (no server HTML fetch). */
  mode: z.enum(["mock", "fetch", "visual"]).optional(),
});

/** Origin browsers use for `/api/...` so preview HTML can emit absolute links (remote `<base>` breaks root-relative `/api`). */
function previewPublicBaseFromRequest(req: FastifyRequest): string | undefined {
  const xfProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(",")[0]?.trim() || req.protocol;
  const hostRaw = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;
  if (!host || typeof host !== "string") return undefined;
  return `${proto}://${host.split(",")[0]!.trim()}`;
}

export async function registerBrowserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/browser/capabilities", async (_req, reply) => {
    return reply.send(
      apiOk({
        playwrightEnabled: isPlaywrightBrowserEnabled(),
        previewUnsafeFullPage: isPreviewUnsafeFullPageEnabled(),
      }),
    );
  });

  /**
   * Same-origin HTML preview for the in-app browser iframe. Fetches the target URL on the server,
   * strips active content, and rewrites with &lt;base&gt; so relative assets resolve. Avoids
   * cross-origin iframe blocks (x.com etc.) when the remote server allows our fetch.
   */
  app.get("/api/spaces/:spaceId/browser/preview", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const rawQ = (req.query as Record<string, unknown>).url;
    const decoded = typeof rawQ === "string" ? rawQ.trim() : "";
    if (!decoded) return reply.code(400).send(apiErr("missing_url", "Missing url query parameter."));
    let normalized: string;
    try {
      normalized = normalizeHttpUrl(decoded);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Invalid URL."));
    }
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const doc = await buildBrowserPreviewDocument(spaceId, normalized, {
      previewPublicBase: previewPublicBaseFromRequest(req),
    });
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "private, max-age=15");
    return reply.send(doc);
  });

  /** PNG snapshot of the Playwright page for this space (Space Agent–style live view). 404 if Playwright off or no session. */
  app.get("/api/spaces/:spaceId/browser/live-view.png", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    const buf = await playwrightScreenshotPng(spaceId);
    if (!buf) {
      return reply.code(404).send(apiErr("no_live_view", "No Playwright page for this workspace yet."));
    }
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "private, no-store");
    return reply.send(buf);
  });

  app.post("/api/browser/transcribe", async (req, reply) => {
    const body = TranscribeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const mode =
      body.data.mode ?? (body.data.url.startsWith("http") ? ("fetch" as const) : ("mock" as const));
    const t = await transcribeUrl(body.data.url, mode);
    return reply.send(apiOk({ transcription: t }));
  });

  app.get("/api/spaces/:spaceId/browser", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const s = await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ session: s }));
  });

  app.get("/api/spaces/:spaceId/browser/session", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const s = await browserSession.getSession(spaceId, DEFAULT_USER_ID);
    return reply.send(apiOk({ session: s }));
  });

  app.post("/api/spaces/:spaceId/browser/navigate", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = NavigateBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));

    let normalized: string;
    try {
      normalized = normalizeHttpUrl(body.data.url);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
    }

    const mode =
      body.data.mode ??
      (normalized.startsWith("http") ? ("fetch" as const) : ("mock" as const));

    if (mode === "visual") {
      const capturedAt = new Date().toISOString();
      const t: BrowserPageTranscription = {
        url: normalized,
        title: normalized,
        visibleTextSummary:
          "Visual browsing: the page is rendered in the embedded frame. Open “Agent page summary” below to fetch a text snapshot for the agent.",
        interactiveElements: [],
        forms: [],
        scrollPosition: 0,
        capturedAt,
      };
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(
        apiOk({
          session,
          transcription: t,
          result: { implemented: true, message: "navigated_visual" },
        }),
      );
    }

    try {
      const t = await transcribeUrl(normalized, mode);
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(
        apiOk({
          session,
          transcription: t,
          result: { implemented: true, message: "navigated" },
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(apiErr("transcribe_failed", msg.slice(0, 400)));
    }
  });

  app.post("/api/spaces/:spaceId/browser/action", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = BrowserActionRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));
    const { session, result } = await applyBrowserActionRequest(spaceId, body.data, DEFAULT_USER_ID);
    return reply.send(apiOk({ session, result }));
  });

  app.post("/api/spaces/:spaceId/browser/transcribe", async (req, reply) => {
    const { spaceId } = req.params as { spaceId: string };
    const body = TranscribeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(apiErr("invalid_body", body.error.message));

    let normalized: string;
    try {
      normalized = normalizeHttpUrl(body.data.url);
    } catch {
      return reply.code(400).send(apiErr("invalid_url", "Enter a valid http(s) URL."));
    }

    const mode =
      body.data.mode ?? (normalized.startsWith("http") ? ("fetch" as const) : ("mock" as const));
    try {
      const t = await transcribeUrl(normalized, mode);
      const session = await browserSession.applyNavigate(spaceId, t.url, t, DEFAULT_USER_ID, {
        recordPriorUrl: true,
      });
      return reply.send(apiOk({ transcription: t, session }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(apiErr("transcribe_failed", msg.slice(0, 400)));
    }
  });
}
