---
"fusion-action-app-change": minor
---

Add support for mono repository mode through MONO environment variable or mono input parameter. When mono mode is enabled, app-paths defaults to "apps/*", otherwise defaults to "." for single-app repositories. Also update changeset:version script to automatically run pnpm install and build after versioning.
