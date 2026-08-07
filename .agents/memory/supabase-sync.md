---
name: Supabase sync
description: Cloud persistence boundary for the Pages journaling app.
---

Pages keeps AsyncStorage as its offline cache and uses Supabase REST/Auth/Storage as an optional cloud layer.

**Why:** The mobile app must remain usable offline, while journal and vault data need a private cloud path. The public anon key cannot create database tables, so schema setup remains a one-time user action in Supabase.

**How to apply:** Preserve the local-first behavior. If cloud requests fail or the SQL schema is not present, show/use local storage rather than blocking journal or vault actions. Keep vault Storage private and scoped by the anonymous auth user ID.