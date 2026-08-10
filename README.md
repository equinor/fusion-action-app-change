# Fusion App Change Detection Action

A GitHub Action that intelligently detects changes in Fusion applications within a repository and provides detailed information about what has changed. This action is designed to help with continuous deployment workflows by identifying which Fusion apps need to be built, tested, or deployed.

## 🚀 Quick Start

```yaml
- uses: equinor/fusion-action-app-change@v1
  id: detect
- if: steps.detect.outputs.has-changes == 'true'
  run: echo "Changed apps: ${{ steps.detect.outputs.changed-app-names }}"
```

## 📚 Documentation

- **[Configuration Guide](docs/CONFIGURATION.md)** - Detailed configuration options and patterns
- **[API Documentation](docs/API.md)** - Complete input/output reference and function API
- **[Examples & Use Cases](docs/EXAMPLES.md)** - Real-world workflow examples
- **[Architecture Overview](docs/ARCHITECTURE.md)** - Technical architecture and design decisions
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to this project
- **[Security Policy](SECURITY.md)** - Security considerations and reporting

## Features

- 🎯 **Zero Configuration** - Works out of the box with sensible defaults
- 🔍 **Smart Discovery** - Automatically finds Fusion apps using configurable workspace patterns
- 📦 **App vs Library Classification** - Distinguishes between deployable apps and shared libraries
- 📁 **Intelligent Change Detection** - Compares commits to identify modified apps and files
- 🗂️ **pnpm Catalog Awareness** - Maps changed workspace catalog entries to the apps that consume them
- 📊 **Detailed Output**: Provides structured JSON output with change metadata and app types
- 🚀 **CI/CD Integration**: Perfect for triggering builds only for changed apps
- 💬 **PR Comments**: Automatically comments on pull requests with change summaries
- 🏗️ **Workspace Support**: Handles monorepos with multiple workspace patterns

## Usage

### Basic Usage

```yaml
name: Detect Fusion App Changes

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        # That's it! No configuration needed for most cases

      - name: Build changed apps
        if: steps.detect.outputs.has-changes == 'true'
        run: |
          echo "Changed apps: ${{ steps.detect.outputs.changed-apps }}"
```

### Custom App Paths

```yaml
- name: Detect changes in specific directories
  uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: 'apps,packages/fusion-apps,services'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `app-paths` | Comma-separated list of paths to directories containing fusion apps (e.g., `apps,packages/apps`) | No | "." |
| `token` | GitHub token for API access | No | `${{ github.token }}` |

**That's it!** The action automatically:
- Detects the correct base/head refs for PRs and pushes
- Finds Fusion apps using smart workspace detection
- Uses sensible file patterns for change detection
- Detects apps affected by changed default or named catalogs in `pnpm-workspace.yaml`
- Distinguishes between apps and libraries

When the root `pnpm-workspace.yaml` changes, the action compares catalog entries between the
selected git base and `HEAD`. Apps are marked as changed only when their `package.json` references
an added, removed, or updated entry using `catalog:`, `catalog:default`, or `catalog:<name>` in
`dependencies`, `devDependencies`, `optionalDependencies`, or `peerDependencies`.

## Outputs

| Output | Description | Type |
|--------|-------------|------|
| `changed-apps` | JSON array of changed fusion apps with metadata | JSON |
| `changed-apps-count` | Number of changed fusion apps detected | String |
| `changed-app-names` | Comma-separated list of changed app names | String |
| `changed-app-paths` | JSON array of changed app root paths | JSON |
| `changed-files` | JSON array of all changed files | JSON |
| `has-changes` | Whether any changes were detected | Boolean |
| `summary` | Human-readable summary of changes detected | String |
| `app-types` | JSON array of app names and their types | JSON |

## Output Schema

### Changed Apps Array

```json
[
  {
    "name": "my-fusion-app",
    "path": "apps/my-fusion-app",
    "manifestPath": "apps/my-fusion-app/app-manifest.json",
    "manifest": {
      "key": "my-fusion-app",
      "name": "My Fusion App",
      "version": "1.2.3",
      "type": "standalone"
    },
    "packageJsonPath": "apps/my-fusion-app/package.json",
    "packageJson": {
      "name": "my-fusion-app",
      "version": "1.2.3",
      "dependencies": {
        "@equinor/fusion-framework-cli": "^1.0.0"
      }
    },
    "appType": "fusion-cli-app",
    "isDeployable": true,
    "changedFiles": [
      {
        "path": "apps/my-fusion-app/src/index.ts",
        "status": "modified",
        "additions": 10,
        "deletions": 5
      }
    ]
  }
]
```

### App Types

The action classifies discovered packages into the following types:

- **`fusion-cli-app`**: Uses `@equinor/fusion-framework-cli` for building
- **`react-fusion-app`**: React-based Fusion application
- **`fusion-app`**: Generic Fusion application with app-specific scripts
- **`fusion-library`**: Shared library/components (not deployable)

## Detection Strategy

### App vs Library Classification

The action uses sophisticated logic to distinguish between **deployable Fusion apps** and **shared Fusion libraries**:

#### 🚀 **Fusion Apps (Deployable)**:
- Have `@equinor/fusion-framework-cli` dependency
- Contain app-specific scripts (`app:build`, `app:dev`, `fusion:build`, `start`)
- Have Fusion app configuration (`fusion` or `fusionApp` fields in package.json)
- Located in `apps/` or `applications/` directories
- Are private packages (`"private": true`)

#### 📚 **Fusion Libraries (Shared Code)**:
- Have library structure (`main`, `module`, or `exports` fields)
- Are publishable to npm (`"private": false` or undefined)
- Located in `packages/` or `libs/` directories
- Lack app-specific scripts or CLI dependencies

### Workspace Pattern Detection

The action supports flexible workspace patterns to find apps:

```yaml
workspace-patterns: 'apps/*/package.json,packages/app-*/package.json,services/*/package.json'
```

This allows the action to work with various monorepo structures:

```
monorepo/
├── apps/
│   ├── portal-app/           # ✅ Detected as fusion-cli-app
│   └── dashboard/            # ✅ Detected as react-fusion-app
├── packages/
│   ├── fusion-components/    # ❌ Skipped (fusion-library)
│   └── app-shell/            # ✅ Detected if has CLI/scripts
└── services/
    └── api-gateway/          # ✅ Detected if matches criteria
```

```
your-repo/
├── apps/
│   ├── app-one/
│   │   ├── app-manifest.json    # Required
│   │   ├── package.json         # Optional
│   │   └── src/
│   └── app-two/
│       ├── app-manifest.json
│       └── src/
└── packages/
    └── shared-components/
```

### Required: `app-manifest.json`

```json
{
  "key": "my-fusion-app",
  "name": "My Fusion App",
  "version": "1.0.0",
  "type": "standalone",
  "description": "A sample Fusion application",
  "category": "tools"
}
```

## Example Workflows

### Conditional Build Based on Changes

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      changed-apps: ${{ steps.detect.outputs.changed-apps }}
      has-changes: ${{ steps.detect.outputs.has-changes }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1

  build-apps:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest

    strategy:
      matrix:
        app: ${{ fromJson(needs.detect-changes.outputs.changed-apps) }}

    steps:
      - uses: actions/checkout@v4

      - name: Build ${{ matrix.app.name }}
        run: |
          cd ${{ matrix.app.path }}
          npm ci
          npm run build
```

### PR Comment with Changes

```yaml
- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const apps = JSON.parse('${{ steps.detect.outputs.changed-apps }}');

      if (apps.length === 0) {
        await github.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: '✅ No Fusion apps were changed in this PR.'
        });
      } else {
        const appList = apps.map(app => `- ${app.name} (${app.changedFiles.length} files)`).join('\n');
        await github.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: `🚀 **Fusion Apps Changed:**\n\n${appList}`
        });
      }
```

## Development

### Building the Action

```bash
# Install dependencies
pnpm install

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

**Note**: This action uses JavaScript directly, so no build step is required!

### Testing Locally

You can test the action locally using [act](https://github.com/nektos/act):

```bash
# Install act
# On macOS: brew install act

# Run the workflow
act pull_request --secret GITHUB_TOKEN=your_token
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions or issues, please:
1. Check the [GitHub Issues](https://github.com/equinor/fusion-action-app-change/issues)
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your use case and environment
