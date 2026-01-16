# fusion-action-app-change

## 0.1.3

### Patch Changes

- [#6](https://github.com/equinor/fusion-action-app-change/pull/6) [`f23095f`](https://github.com/equinor/fusion-action-app-change/commit/f23095f0a077fc03a11ed971151eccecd1302e02) Thanks [@Noggling](https://github.com/Noggling)! - Fix npm publishing issue in CI workflow

  - Prevent npm publishing attempts for GitHub Action
  - Configure changeset to only create GitHub releases and tags
  - Set package as private to avoid npm registry errors

## 0.1.2

### Patch Changes

- [#2](https://github.com/equinor/fusion-action-app-change/pull/2) [`3c3c0b3`](https://github.com/equinor/fusion-action-app-change/commit/3c3c0b31ec6be8afc98c16c3651a9239bcf2c363) Thanks [@Noggling](https://github.com/Noggling)! - Fix undici security vulnerability and update dependencies

  - Add pnpm override to force undici >= 6.23.0 to fix CVE (unbounded decompression vulnerability)
  - Update @actions/core from 1.10.1 to 2.0.2
  - Update @biomejs/biome from 1.9.4 to 2.3.11 with updated configuration
  - Update jest from 29.7.0 to 30.2.0

  Resolves Dependabot security alert for undici transitive dependency.

- [#4](https://github.com/equinor/fusion-action-app-change/pull/4) [`b2ad722`](https://github.com/equinor/fusion-action-app-change/commit/b2ad7228f0d942c9d93f3a1ac67d9cc4aef3b993) Thanks [@Noggling](https://github.com/Noggling)! - **Security Fix**: Prevent command injection vulnerability in git diff commands

  Fixed unsafe shell command construction in `getChangedFiles` function that could allow command injection attacks through the `baseRef` parameter. The fix includes:

  - Added `shell-quote` dependency for safe argument escaping
  - Replaced unsafe string interpolation with `shell-quote.quote()`
  - Added comprehensive test coverage to verify protection against malicious input

  This addresses the CodeQL security alert for "Unsafe shell command constructed from library input" while maintaining full functionality.

## 0.1.1

### Patch Changes

- [`22325cd`](https://github.com/equinor/fusion-action-app-change/commit/22325cd4015b04f897948a02445a2e53bc33fa06) Thanks [@Noggling](https://github.com/Noggling)! - Initial changeset setup for automated release management
