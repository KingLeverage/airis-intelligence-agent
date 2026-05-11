#!/usr/bin/env node
/**
 * HTTP CLI against a running AIRIS server (same widget REST as the web app).
 *
 *   AIRIS_API=http://127.0.0.1:8787 node scripts/airis-cli.mjs help
 *   npm run airis -- spaces list
 *   npm run airis -- widgets list <spaceId>
 *   npm run airis -- widgets delete <spaceId> <widgetId>
 */
const base = (process.env.AIRIS_API ?? "http://127.0.0.1:8787").replace(/\/$/, "");

async function req(method, path, body) {
  const init = { method, headers: {} };
  if (body != null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

function unwrap(data) {
  if (data && typeof data === "object" && data.ok === true && "data" in data) return data.data;
  return data;
}

function printHelp() {
  console.log(`airis-cli — AIRIS API helper

  Base URL: ${base} (override with AIRIS_API)

Commands:
  spaces list
  widgets list <spaceId>
  widgets delete <spaceId> <widgetId>
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    process.exit(argv.length === 0 ? 0 : 0);
  }

  const [a0, a1, a2, a3] = argv;

  if (a0 === "spaces" && a1 === "list") {
    const { status, json } = await req("GET", "/api/spaces");
    console.log(status, JSON.stringify(unwrap(json), null, 2));
    process.exit(status >= 400 ? 1 : 0);
  }

  if (a0 === "widgets" && a1 === "list" && a2) {
    const { status, json } = await req("GET", `/api/spaces/${encodeURIComponent(a2)}/widgets`);
    console.log(status, JSON.stringify(unwrap(json), null, 2));
    process.exit(status >= 400 ? 1 : 0);
  }

  if (a0 === "widgets" && a1 === "delete" && a2 && a3) {
    const { status, json } = await req(
      "DELETE",
      `/api/spaces/${encodeURIComponent(a2)}/widgets/${encodeURIComponent(a3)}`,
    );
    console.log(status, JSON.stringify(unwrap(json), null, 2));
    process.exit(status >= 400 ? 1 : 0);
  }

  console.error("Unknown command. Run: node scripts/airis-cli.mjs help");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
