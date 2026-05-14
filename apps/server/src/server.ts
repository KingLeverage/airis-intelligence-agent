import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { getHost, getPort } from "./config.js";
import * as store from "./persistence/space-store.js";
import { registerSpaceRoutes } from "./routes/spaces.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerWidgetRoutes } from "./routes/widgets.js";
import { registerCliToolRoutes } from "./routes/cli-tools.js";
import { registerSnapshotRoutes } from "./routes/snapshots.js";
import { registerBrowserRoutes } from "./routes/browser.js";
import { registerLeadFinderRoutes } from "./routes/lead-finder.js";
import { registerNativeBrowserRoutes } from "./routes/native-browser.js";
import { registerLlmRoutes } from "./routes/llm.js";
import { registerProfileLlmRoutes } from "./routes/profile-llm.js";
import { registerRecoveryRoutes } from "./routes/recovery.js";
import { registerLayoutRoutes } from "./routes/layout.js";
import { registerExecutionRoutes } from "./routes/executions.js";
import { registerSkillRoutes } from "./routes/skills.js";
import { registerDevFlagshipDemoRoutes } from "./routes/dev-flagship-demos.js";
import { registerReferenceLibraryRoutes } from "./routes/reference-library.js";
import { registerAgentStreamRoutes } from "./routes/agent-stream.js";
import { isFlagshipDemoRecipeRefreshEnabled } from "./config.js";
import { assertRegistryMatchesSchema } from "@airis/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

/** Default 1MB is too small for widget PATCH bodies that embed base64 audio (mini player uploads). */
const app = Fastify({ logger: true, bodyLimit: 40 * 1024 * 1024 });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

assertRegistryMatchesSchema();

app.get("/api/health", async () => ({ ok: true }));

await registerSpaceRoutes(app);
await registerChatRoutes(app);
await registerWidgetRoutes(app);
await registerCliToolRoutes(app);
await registerLayoutRoutes(app);
await registerSnapshotRoutes(app);
await registerBrowserRoutes(app);
await registerLeadFinderRoutes(app);
await registerNativeBrowserRoutes(app);
await registerLlmRoutes(app);
await registerProfileLlmRoutes(app);
await registerRecoveryRoutes(app);
await registerExecutionRoutes(app);
await registerSkillRoutes(app);
await registerReferenceLibraryRoutes(app);
await registerAgentStreamRoutes(app);
if (isFlagshipDemoRecipeRefreshEnabled()) {
  await registerDevFlagshipDemoRoutes(app);
}

await store.initGlobalFiles();

const port = getPort();
const host = getHost();
try {
  await app.listen({ port, host });
} catch (err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as NodeJS.ErrnoException).code)
      : undefined;
  if (code === "EADDRINUSE") {
    app.log.error(
      `Port ${port} is already in use — stop the other process or pick another port (e.g. PORT=8788 npm run dev -w @airis/server). On macOS: lsof -nP -iTCP:${port} -sTCP:LISTEN`
    );
  }
  throw err;
}
app.log.info(`AIRIS API listening on http://${host}:${port}`);
