---
"fusion-action-app-change": patch
---

Fix the release workflow so `changesets/action@v2` inputs/outputs and Changesets v3 `privatePackages` versioning work properly, prevent CI from overwriting existing `vX.Y.Z` tags on non-release pushes to `main`, create GitHub Releases populated from `CHANGELOG.md`, and update floating `vX` / `vX.Y` aliases only on new stable releases.

Documents the release-tag immutability policy, GitHub Immutable Releases safeguards, and SHA-pinned consumer guidance. This patch release also supersedes commit `d8a648b` (#25), which previously moved `v2.0.0` without a distinct release or changelog entry.
