---
name: Expo build port conflict
description: A workspace workflow can occupy the fixed Metro port used by the Expo static build script.
---

The Expo static build should run with the component preview workflow stopped when that workflow owns port 8081; the build script does not accept Expo's interactive “use another port” prompt.

**Why:** A concurrent Metro server makes the non-interactive build exit before bundle generation instead of switching ports automatically.

**How to apply:** Stop the component preview workflow before the build, then restart it after the build completes.