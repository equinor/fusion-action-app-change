---
"fusion-action-app-change": patch
---

Fix tag creation for GitHub Action versioning

- Update CI workflow condition to create tags after changeset processing
- Ensure proper versioning tags are created (v1, v1.2, v1.2.3) for GitHub Actions marketplace
- Fix issue where tags weren't created after removing npm publishing step
