---
"fusion-action-app-change": patch
---

Fix undici security vulnerability and update dependencies

- Add pnpm override to force undici >= 6.23.0 to fix CVE (unbounded decompression vulnerability)
- Update @actions/core from 1.10.1 to 2.0.2
- Update @biomejs/biome from 1.9.4 to 2.3.11 with updated configuration
- Update jest from 29.7.0 to 30.2.0

Resolves Dependabot security alert for undici transitive dependency.
