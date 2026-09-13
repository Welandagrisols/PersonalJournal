---
name: Supabase Replit connectivity
description: The reliable Supabase database connection mode for this Replit environment.
---

Use the active Supabase project's Session pooler connection URI for database schema work from Replit. Direct `db.<project>.supabase.co` connection hosts may fail DNS resolution even when the project's REST endpoint is healthy.

**Why:** The app's REST URL and anon key can be reachable while the direct Postgres hostname is unavailable from the Replit runtime.

**How to apply:** Keep `SUPABASE_DATABASE_URL` aligned with `SUPABASE_URL` and prefer the Session pooler URI from Supabase Connect when applying SQL or running database checks.