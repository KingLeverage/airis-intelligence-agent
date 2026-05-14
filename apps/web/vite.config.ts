import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Set by `scripts/dev-desktop.mjs` when the API uses a non-default port (stale 8787 listener). */
const rawProxy = Number(process.env.AIRIS_API_PROXY_PORT || 8787);
const apiProxyPort = Number.isFinite(rawProxy) && rawProxy > 0 ? rawProxy : 8787;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@airis/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    /** When set (e.g. `npm run dev:desktop`), Vite must stay on 5173 so `wait-on` + Electron `WEB_URL` match. */
    strictPort: process.env.AIRIS_DESKTOP_DEV === "1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiProxyPort}`,
        changeOrigin: true,
      },
    },
  },
});
