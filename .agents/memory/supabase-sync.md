---
name: Supabase sync
description: Cloud persistence boundary for the Pages journaling app.
---

Pages keeps AsyncStorage as its offline cache and uses Supabase REST/Auth/Storage as an optional cloud layer. Users authenticate with email/password.

**Why:** The mobile app must remain usable offline, while journal and vault data need a private, recoverable cloud path. Anonymous auth would not support reliable account recovery or multi-device access.

**How to apply:** Preserve the local-first behavior. If cloud requests fail or the SQL schema is not present, show/use local storage rather than blocking journal or vault actions. Keep vault Storage private and scoped by the signed-in auth user ID. Keep local cache keys account-scoped.