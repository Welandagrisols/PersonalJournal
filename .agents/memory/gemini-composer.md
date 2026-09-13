---
name: Gemini composer
description: Privacy and product boundary for Pages writing assistance.
---

Pages sends journal-writing requests to Gemini only through the authenticated API server. The Gemini credential must remain server-side, and the mobile app must attach the signed-in Supabase bearer token before using the composer.

**Why:** Journal and vault content is private, so an Expo bundle must not contain the Gemini credential or expose an unauthenticated AI route.

**How to apply:** Keep writing assistance separate from any future web-search feature. Current-information answers need an explicit, source-aware flow rather than being implied by Gemini text generation.