#!/usr/bin/env node
/**
 * Opens the AIRIS web app with the Browser panel (embedded shell) via deep link.
 * Requires the Vite dev server (default http://127.0.0.1:5173) or set AIRIS_WEB_URL.
 */
import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.VITE_DEV_PORT ?? "5173";
const envUrl = process.env.AIRIS_WEB_URL?.trim();
const origin = (envUrl || `http://127.0.0.1:${port}`).replace(/\/$/, "");

const extra = process.argv.slice(2).find((a) => a && !a.startsWith("-"));
let browserUrl = "";
if (extra) {
  try {
    const u = new URL(extra);
    if (u.protocol === "http:" || u.protocol === "https:") browserUrl = u.href;
    else console.warn("[open-browser] Ignoring non-http(s) URL:", extra);
  } catch {
    console.warn("[open-browser] Ignoring invalid URL:", extra);
  }
}

const qs = new URLSearchParams();
qs.set("panel", "browser");
if (browserUrl) qs.set("browserUrl", browserUrl);
const url = `${origin}/?${qs}`;

const platform = process.platform;
const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
const args = platform === "win32" ? ["/c", "start", "", url] : [url];

const child = spawn(cmd, args, { stdio: "inherit", shell: platform === "win32" });
child.on("error", (err) => {
  console.error("[open-browser] Failed to launch browser:", err.message);
  console.error("Open manually:", url);
  process.exitCode = 1;
});
