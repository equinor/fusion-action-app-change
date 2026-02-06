---
"fusion-action-app-change": patch
---


Fix bug where single-app repositories (app path ".") were not detecting file changes correctly. The change detection now properly handles root-level apps by recognizing that all changed files belong to the root-level app.

