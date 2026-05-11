# apps/web/src/app — AGENTS.md

## Purpose

Application **composition** layer: providers, router, layout aliases. Feature implementations stay in `features/*`.

## Files

- `providers/` — `AppProviders` (StrictMode, BrowserRouter)
- `router/` — `AppRoutes` (React Router routes)
- `layout/` — re-exports of page shells for imports that prefer this path

## Extension

Add global providers only here; avoid importing heavy feature modules from `providers` unless necessary.
