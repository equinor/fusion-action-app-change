---
"fusion-action-app-change": patch
---

Greenkeep dependencies and resolve open security alerts.

- Bump `undici` to 8.12.3, `vite` to 8.3.5 and `vitest`/`@vitest/ui` to 5.1.0, resolving advisories in `undici`, `vite`, `@vitest/mocker` and `launch-editor`
- Bump `@actions/core` to 3.0.1, `shell-quote` to 1.12.0, `typescript` to 7.0.2, `@biomejs/biome` to 2.6.4, `@changesets/changelog-github` to 1.0.1 and `@types/node` to 26.6.6
- Migrate build config to Vite 8 (Rolldown/Oxc) and polyfill `import.meta.url` in the CJS bundle so the action entrypoint still runs
- Bump `actions/setup-node` to v7.1.0 and `actions/cache` to v6.1.0 in the node-setup composite action
