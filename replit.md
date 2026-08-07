# Journal App

A mobile journaling app with mood tracking, multiple entry types, and a PIN-protected vault — backed by an Express/PostgreSQL API server.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SUPABASE_DATABASE_URL` — Supabase Postgres connection string (Settings → Database → Connection string → URI). Falls back to `DATABASE_URL` if set.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- The mobile app is local-first: AsyncStorage remains the offline cache and Supabase is an optional cloud sync layer.
- Supabase uses email/password auth with Row Level Security so journal entries, settings, and vault metadata are private to the signed-in account.
- Vault images use a private Supabase Storage bucket when cloud upload is available; the native app also keeps a local file copy.
- The one-time Supabase SQL setup is in `artifacts/journal-app/supabase/schema.sql`. Anonymous sign-ins must also be enabled in Supabase Authentication.

## Product

Pages is a warm, PIN-protected personal journal with multiple entry types, mood tracking, calendar browsing, and a private photo vault. Entries and vault metadata can sync to Supabase while remaining usable offline.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `artifacts/journal-app/supabase/schema.sql` in the Supabase SQL Editor before expecting cloud sync; email/password authentication must be enabled in Supabase Authentication.
- Keep the Supabase anon key client-safe and never put a service-role key in the mobile app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
