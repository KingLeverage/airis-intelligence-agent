#!/usr/bin/env node
/**
 * Desktop dev bootstrap: pick a free API port (8787+), start server → Vite → Electron,
 * and align the Vite `/api` proxy via AIRIS_API_PROXY_PORT. Avoids the common failure where
 * 8787 is still held by a stale process, the new server crashes, but Vite/Electron still start
 * and the app appears “broken” only under Electron.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function canBindLocalhostPort(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => {
      srv.close(() => resolve(true));
    });
  });
}

async function pickApiPort() {
  const start = Math.min(65535, Math.max(1, Number(process.env.PORT ?? 8787) || 8787));
  for (let p = start; p < start + 48; p++) {
    if (await canBindLocalhostPort(p)) return p;
  }
  throw new Error(`No free localhost port found starting at ${start}`);
}

async function waitForHealth(port, serverProc, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProc.exitCode != null) {
      throw new Error(`API server exited early (code ${serverProc.exitCode})`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(120);
  }
  throw new Error(`Timed out waiting for http://127.0.0.1:${port}/api/health`);
}

async function waitForVite(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:5173/", { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      /* retry */
    }
    await delay(150);
  }
  throw new Error("Timed out waiting for Vite at http://127.0.0.1:5173/");
}

function npmSpawn(args, extraEnv) {
  const child = spawn("npm", args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  return child;
}

function waitChildExit(proc) {
  return new Promise((resolve) => {
    proc.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of [...children].reverse()) {
    try {
      if (c.pid && !c.killed) c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => {
  if (!shuttingDown) {
    console.log("\n[AIRIS dev:desktop] Interrupted — stopping children…");
    shutdown(130);
  }
});
process.on("SIGTERM", () => shutdown(143));

async function main() {
  const preferred = Number(process.env.PORT ?? 8787);
  const apiPort = await pickApiPort();
  if (apiPort !== preferred) {
    console.log(
      `[AIRIS dev:desktop] Using API port ${apiPort} (preferred ${preferred} is in use — likely a stale server).`,
    );
  } else {
    console.log(`[AIRIS dev:desktop] API port ${apiPort}`);
  }

  const serverProc = npmSpawn(["run", "dev", "-w", "@airis/server"], { PORT: String(apiPort) });
  await waitForHealth(apiPort, serverProc);

  const webProc = npmSpawn(["run", "dev", "-w", "@airis/web"], {
    AIRIS_DESKTOP_DEV: "1",
    AIRIS_API_PROXY_PORT: String(apiPort),
  });

  await waitForVite();

  const electronProc = npmSpawn(["run", "dev", "-w", "@airis/desktop"], {
    AIRIS_WEB_URL: "http://127.0.0.1:5173",
  });

  const first = await Promise.race([
    waitChildExit(serverProc),
    waitChildExit(webProc),
    waitChildExit(electronProc),
  ]);
  if (!shuttingDown) {
    const c = first.code;
    const sig = first.signal ? ` signal=${first.signal}` : "";
    console.log(`[AIRIS dev:desktop] A child process exited (code ${c ?? "null"}${sig}) — stopping others.`);
    shutdown(c === 0 || c === null ? 0 : c);
  }
}

main().catch((err) => {
  console.error("[AIRIS dev:desktop]", err);
  shutdown(1);
});
