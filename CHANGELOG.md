# fusion-action-app-change

## 0.3.0

### Minor Changes

- [`ebd918b`](https://github.com/equinor/fusion-action-app-change/commit/ebd918b9c53fb5b7613a5757123df0e6e86b76e1) Thanks [@Noggling](https://github.com/Noggling)! - Add support for mono repository mode through MONO environment variable or mono input parameter. When mono mode is enabled, app-paths defaults to "apps/\*", otherwise defaults to "." for single-app repositories. Also update changeset:version script to automatically run pnpm install and build after versioning.

## 0.2.6

### Patch Changes

- [#12](https://github.com/equinor/fusion-action-app-change/pull/12) [`643a872`](https://github.com/equinor/fusion-action-app-change/commit/643a872eeba71a712a920f6a8c84c813e721a81e) Thanks [@Noggling](https://github.com/Noggling)! - Fix build issues with the latest version of Node.js.

## 0.2.0

### Minor Changes

- [#10](https://github.com/equinor/fusion-action-app-change/pull/10) [`6692cda`](https://github.com/equinor/fusion-action-app-change/commit/6692cdaad3720414431b588769be1f53a90854ff) Thanks [@Noggling](https://github.com/Noggling)! - Major refactoring and modernization of the GitHub Action:

  **🏗️ Architecture Improvements:**

  - Migrated from `scripts/` to `src/` directory structure
  - Split monolithic code into focused modules (git, fusion-app, outputs, types)
  - Converted JavaScript to TypeScript with strict configuration
  - Replaced Jest with Vitest for testing consistency

  **🔧 Build & Tooling:**

  - Switched from @vercel/ncc to Vite for bundling (aligns with project standards)
  - Added comprehensive TypeScript type definitions
  - Updated all configurations for new modular structure
  - Enhanced CI to validate dist files are up-to-date

  **✅ Quality & Testing:**

  - All 24 tests passing with improved Vitest mocking
  - Better code organization for maintainability and testability
  - Updated documentation with implementation details
  - Maintained 100% backward compatibility

  **🐛 Fixes:**

  - Resolved "Cannot find module '@actions/core'" issue via proper dependency bundling
  - Fixed CI workflow to ensure dist files are always current
  - Improved error handling and output management

## 0.1.4

### Patch Changes

- [#8](https://github.com/equinor/fusion-action-app-change/pull/8) [`d0a5280`](https://github.com/equinor/fusion-action-app-change/commit/d0a5280e9bb2fe988e4acf1e78b3df22831fc2c5) Thanks [@Noggling](https://github.com/Noggling)! - Fix tag creation for GitHub Action versioning

  - Update CI workflow condition to create tags after changeset processing
  - Ensure proper versioning tags are created (v1, v1.2, v1.2.3) for GitHub Actions marketplace
  - Fix issue where tags weren't created after removing npm publishing step

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
