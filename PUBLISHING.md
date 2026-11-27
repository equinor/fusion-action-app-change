# Publishing Guide

This guide explains how new versions of `equinor/fusion-action-app-change` are versioned and published through the automated Changesets workflow.

## 📦 Automated Release Process

This repository uses [Changesets](https://github.com/changesets/changesets) with two separate workflows so normal merges to `main` never run release tagging:

- **`.github/workflows/ci.yml`** (`push` on `main`): runs tests/lint/build and runs `changesets/action` to open or update the draft Release PR (`changeset-release/main`). It never touches tags or GitHub Releases.
- **`.github/workflows/release.yml`** (`pull_request: [closed]` on `main`, plus `workflow_dispatch` on `main`): runs `.github/scripts/release-tags.sh` **only** when the same-repository `changeset-release/main` Release PR is merged into `main` (or manually dispatched on `main` for recovery).

### Standard Release Workflow

1. **Add a changeset with your PR**
   ```bash
   pnpm changeset
   ```
   Commit the generated `.changeset/*.md` file alongside your changes and merge the PR to `main`.

2. **Review the Release PR**
   - When changesets land on `main`, `ci.yml` runs `changesets/action` and opens or updates a draft Release PR from `changeset-release/main` titled `"🤖 Release - Fusion Action App Change"`.
   - Verify the version bump in `package.json`, the generated `CHANGELOG.md` entries, and the rebuilt `dist/` files.
   - Mark the PR ready for review and merge it when ready to release.

3. **Release Publication**
   - Merging the `changeset-release/main` PR triggers `release.yml`, which checks out the exact `merge_commit_sha` on `main` and runs `.github/scripts/release-tags.sh`:
     - Validates the `package.json` version against strict SemVer 2.0.0.
     - Resolves the exact commit that introduced the version along `--first-parent` history (recovering dropped or failed release runs at the version-introducing commit rather than tagging a later non-release `HEAD`).
     - Confirms `vX.Y.Z` does not already exist on `origin`, then creates and pushes the immutable `vX.Y.Z` tag without `--force`.
     - Creates a GitHub Release for `vX.Y.Z` using the matching `## X.Y.Z` section from `CHANGELOG.md` at that release commit.
     - Snapshots remote alias OIDs and updates floating `vX.Y` and `vX` aliases with `--force-with-lease` only for the highest stable release (never for prereleases and never backwards).
   - If a release run fails partway through, re-run the workflow or trigger `release.yml` via `workflow_dispatch` on `main` to finish idempotently.

4. **Non-release commits on `main`**
   - Normal PRs merged to `main` (including those without changesets) never trigger `release.yml`, leaving `vX.Y.Z`, `vX.Y`, and `vX` untouched.

## 🏷️ Versioning, Tags, and Immutability Policy

The release automation separates **immutable release tags** from **floating compatibility aliases**:

- **Release-specific patch tags (`vX.Y.Z`, e.g., `v2.0.1`):** Immutable. Created once per new `package.json` version without `--force`, never overwritten on subsequent commits, and paired with a GitHub Release whose notes match `CHANGELOG.md`.
- **Floating minor aliases (`vX.Y`, e.g., `v2.0`):** Mutable Git tags (no GitHub Release). Updated forward via explicit refspecs only when a new highest stable `vX.Y.*` patch release is published.
- **Floating major aliases (`vX`, e.g., `v2`):** Mutable Git tags (no GitHub Release). Updated forward via explicit refspecs only when a new highest stable `vX.*.*` release is published.
- **Prerelease tags (`vX.Y.Z-rc.1`):** Published as GitHub prereleases and never move `vX` or `vX.Y` aliases.

### Consumer Pinning Guidance

```yaml
# Pin to a full 40-character commit SHA with a version comment (recommended for security-sensitive workflows)
- uses: equinor/fusion-action-app-change@<40-char-commit-sha> # v2.0.1

# Pin to an exact immutable patch tag
- uses: equinor/fusion-action-app-change@v2.0.1

# Follow backward-compatible patch releases on v2.0
- uses: equinor/fusion-action-app-change@v2.0

# Follow backward-compatible minor and patch releases on v2
- uses: equinor/fusion-action-app-change@v2
```

For SHA-pinned consumers (including repositories enforcing GitHub's *Require actions to be pinned to a full-length commit SHA* policy or using Dependabot `github-actions` updates), keep the `# vX.Y.Z` comment alongside the 40-character commit SHA. Because published `vX.Y.Z` tags are never moved, Dependabot only proposes SHA bumps when a new version is genuinely released with matching `CHANGELOG.md` and GitHub Release notes.

### Repository-Level Release Safeguards

In addition to the CI script guards (no `git tag -f` on `vX.Y.Z`, no `git push --tags --force`, remote existence check on `origin`, first-parent version-introducing commit resolution, and `--force-with-lease` floating-alias updates), GitHub provides two complementary repository-level controls:

1. **GitHub Immutable Releases** (*Settings → Releases → Enable immutable releases*): Cryptographically locks every published GitHub Release and its associated `vX.Y.Z` tag against modification or deletion, while still allowing floating `vX` and `vX.Y` Git tags that have no GitHub Release to move forward on new releases. See [GitHub Docs: Using immutable releases and tags to manage your action's releases](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/using-immutable-releases-and-tags-to-manage-your-actions-releases).
2. **Tag Protection Ruleset** (optional defense-in-depth): A repository tag ruleset targeting `refs/tags/v*.*.*` with **Restrict updates** and **Restrict deletions** blocks force-pushes to patch tags even before a GitHub Release is created, while leaving `v*` and `v*.*` aliases outside the pattern.

Never delete, force-move, or recreate an already-published `vX.Y.Z` tag. If a release needs a follow-up fix, add a patch changeset and publish the next unused patch version.

## 📋 Pre-publish Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Linting and formatting pass (`pnpm run lint` and `pnpm run check`)
- [ ] Build succeeds and `dist/` is up to date (`pnpm run build`)
- [ ] Documentation is complete
- [ ] Version in `package.json` and `CHANGELOG.md` accurately reflect the release
- [ ] `action.yml` metadata and inputs/outputs are up to date
- [ ] No sensitive information in code or changelog
- [ ] LICENSE file is present
- [ ] App detection logic handles edge cases

## 🔒 Security Considerations

- Never include real repository paths in examples
- Use placeholder values in documentation
- Ensure detection script handles malformed package.json files
- Test with various directory structures
- Validate all inputs and outputs

## 📈 Post-publish

1. **Monitor usage:**
   - Check GitHub Insights
   - Watch for issues/PRs
   - Monitor marketplace ratings

2. **Maintenance:**
   - Regular dependency updates
   - Node.js version updates
   - Bug fixes and improvements
   - Keep up with GitHub Actions changes

3. **Communication:**
   - Announce in Equinor channels
   - Update internal documentation
   - Create usage guidelines
   - Share example implementations

## 🧪 Testing Before Release

### Test Matrix
Test the action against various scenarios:

- **Repository structures:**
  - Single app repositories
  - Monorepos with multiple apps
  - Mixed app/library repositories
  - Empty repositories

- **Package.json configurations:**
  - Apps with fusion-framework-cli
  - Apps with fusion config
  - Private vs public packages
  - Missing dependencies

- **Change scenarios:**
  - No changes
  - Single app changes
  - Multiple app changes
  - Library-only changes

### Example Test Workflow
```yaml
name: Test Action
on: workflow_dispatch
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./  # Test local action
        with:
          app-paths: 'apps/*'
```