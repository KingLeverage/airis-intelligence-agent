#!/usr/bin/env node
/**
 * Re-applies dashboard recipes for seeded flagship demo spaces (see shared `FLAGSHIP_DEMO_TEMPLATE_IDS`).
 * Requires server with AIRIS_ALLOW_FLAGSHIP_DEMO_RECIPE_REFRESH=1 (see apps/server/.env.example).
 *
 * Usage:
 *   AIRIS_API=http://127.0.0.1:8787 node scripts/refresh-flagship-demos.mjs
 *   FORCE=1 node scripts/refresh-flagship-demos.mjs   # also refresh if user renamed the demo
 */
const base = process.env.AIRIS_API ?? "http://127.0.0.1:8787";
const force = process.env.FORCE === "1";

const res = await fetch(`${base.replace(/\/$/, "")}/api/dev/reapply-flagship-demo-recipes`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ force }),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
