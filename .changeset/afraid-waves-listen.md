---
"fusion-action-app-change": patch
---

Fix npm publishing issue in CI workflow

- Prevent npm publishing attempts for GitHub Action
- Configure changeset to only create GitHub releases and tags
- Set package as private to avoid npm registry errors
