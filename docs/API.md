# API Documentation

## Action Interface

### Inputs

#### `app-paths`
- **Type**: `string`
- **Required**: No
- **Default**: Auto-detection
- **Description**: Comma-separated list of directory patterns where Fusion apps are located

**Supported Formats**:
```yaml
# Single directory with glob pattern
app-paths: 'apps/*'

# Multiple directories
app-paths: 'apps/*,packages/fusion-apps/*,services/*'

# Direct paths (searches the directory itself)
app-paths: 'apps,packages'

# JSON array format
app-paths: '["apps/*", "packages/apps/*"]'
```

**Pattern Examples**:
- `apps/*` - Searches inside the apps directory for subdirectories
- `apps` - Searches the apps directory itself
- `packages/*/apps/*` - Nested pattern for complex monorepos
- `**/apps/*` - Recursive search (use with caution on large repos)

#### `token`
- **Type**: `string`  
- **Required**: No
- **Default**: `${{ github.token }}`
- **Description**: GitHub token for API access (automatically provided by GitHub Actions)

### Outputs

#### Core Outputs

##### `changed-apps`
- **Type**: `JSON Array<AppObject>`
- **Description**: Complete information about changed Fusion apps

**AppObject Schema**:
```typescript
interface AppObject {
  name: string;        // App name from package.json or directory name
  path: string;        // Relative path to app directory
}
```

**Example**:
```json
[
  {
    "name": "portal-dashboard", 
    "path": "apps/portal-dashboard"
  },
  {
    "name": "@company/analytics-app",
    "path": "packages/apps/analytics"
  }
]
```

##### `changed-app-names`
- **Type**: `string` (comma-separated)
- **Description**: Simple list of app names for easy consumption
- **Example**: `"portal-dashboard,analytics-app,user-management"`

##### `changed-app-paths` 
- **Type**: `JSON Array<string>`
- **Description**: Array of relative paths to changed app directories
- **Example**: `["apps/portal-dashboard", "packages/apps/analytics"]`

##### `changed-files`
- **Type**: `JSON Array<string>`
- **Description**: All files that changed in the commit/PR
- **Example**: `["apps/portal/src/index.ts", "packages/shared/utils.ts"]`

##### `has-changes`
- **Type**: `string` (boolean)
- **Description**: Whether any Fusion apps have changes
- **Values**: `"true"` or `"false"`

##### `summary`
- **Type**: `string`
- **Description**: Human-readable summary of changes
- **Examples**: 
  - `"3 Fusion apps changed: portal-dashboard, analytics-app, user-management"`
  - `"No Fusion apps changed"`

#### Advanced Outputs

##### `matrix`
- **Type**: `JSON Object`
- **Description**: GitHub Actions matrix format for parallel job execution
- **Usage**: Perfect for `strategy.matrix` in workflow jobs

**Example**:
```json
{
  "include": [
    { "name": "portal-dashboard", "path": "apps/portal-dashboard" },
    { "name": "analytics-app", "path": "apps/analytics" }
  ]
}
```

**Workflow Usage**:
```yaml
jobs:
  build:
    strategy:
      matrix: ${{ fromJson(needs.detect.outputs.matrix) }}
    steps:
      - name: Build ${{ matrix.name }}
        run: cd ${{ matrix.path }} && npm run build
```

##### `changed-apps-count`
- **Type**: `string` (number)
- **Description**: Number of changed apps as string
- **Example**: `"3"`

##### `app-types`
- **Type**: `JSON Array`
- **Description**: Reserved for future app type classification
- **Current**: Always returns `[]`

## Function API

### Core Functions

#### `run()`
**Signature**: `async function run(): Promise<void>`

Main entry point that orchestrates the entire detection process.

**Process Flow**:
1. Parse input parameters
2. Determine git base reference
3. Get changed files from git diff
4. Discover Fusion apps in workspace
5. Identify changed apps
6. Set GitHub Actions outputs

**Error Handling**: 
- Catches all errors and calls `core.setFailed()`
- Provides detailed error messages for debugging

#### `findFusionApps(patterns)`
**Signature**: `function findFusionApps(patterns: string[]): AppObject[]`

Discovers Fusion applications using configurable directory patterns.

**Parameters**:
- `patterns` - Array of directory patterns to search

**Returns**: Array of discovered apps with `name` and `path` properties

**Algorithm**:
1. Process each pattern (glob or direct path)
2. Find directories matching the pattern
3. Check each directory for `package.json`
4. Validate if directory contains a Fusion app
5. Return aggregated results

#### `isFusionApp(packageJson)`
**Signature**: `function isFusionApp(packageJson: object): boolean`

Classifies a package as a Fusion app vs shared library.

**Parameters**:
- `packageJson` - Parsed package.json content

**Returns**: `true` if package is classified as a Fusion app

**Classification Logic**:

1. **Required**: Must have `@equinor/fusion-*` dependencies
2. **App Indicators** (any qualifies):
   - Has `@equinor/fusion-framework-cli` dependency
   - Has app build scripts (`build`, `start`, contains `fusion-framework-cli` or `ffc`)
   - Has Fusion config (`fusion` or `fusionApp` fields)
   - Is private package (`private: true`)
3. **Library Exclusions**:
   - Publishable packages with library structure (`main`/`module`/`exports` + `private: false`)
   - Packages without app scripts or configuration

**Examples**:
```javascript
// Fusion App (CLI-based)
isFusionApp({
  dependencies: { '@equinor/fusion-framework-cli': '^1.0.0' },
  scripts: { build: 'ffc build', start: 'ffc start' }
}) // → true

// Fusion App (configured)
isFusionApp({
  dependencies: { '@equinor/fusion-framework': '^1.0.0' },
  fusion: { appKey: 'my-app', name: 'My App' },
  private: true
}) // → true

// Fusion Library (excluded)
isFusionApp({
  dependencies: { '@equinor/fusion-components': '^1.0.0' },
  main: 'dist/index.js',
  private: false
}) // → false
```

#### `findChangedApps(changedFiles, allApps)`
**Signature**: `function findChangedApps(changedFiles: string[], allApps: AppObject[]): AppObject[]`

Determines which apps have changes based on modified files.

**Parameters**:
- `changedFiles` - Array of changed file paths
- `allApps` - Array of all discovered Fusion apps

**Returns**: Subset of apps that have changes

**Logic**:
- Normalizes paths (removes `./` prefix)
- Checks if any changed file is within app directory
- Uses string prefix matching with path separators

#### `getBaseRef()`
**Signature**: `function getBaseRef(): string`

Determines appropriate git reference for comparison.

**Returns**: Git reference string (SHA, branch name, or `HEAD~1`)

**Strategy**:
- **Pull Requests**: Uses base branch SHA from GitHub event
- **Push Events**: Uses `HEAD~1`
- **Fallback**: Returns `'main'`

#### `getChangedFiles(baseRef)`
**Signature**: `function getChangedFiles(baseRef: string): string[]`

Gets list of changed files using git diff.

**Parameters**:
- `baseRef` - Git reference to compare against

**Returns**: Array of changed file paths

**Strategies** (tries in order):
1. `git diff --name-only ${baseRef}...HEAD` (three-dot diff for PRs)
2. `git diff --name-only ${baseRef} HEAD` (two-dot diff)
3. `git diff --name-only HEAD~1 HEAD` (last resort)

**Fallback**: Returns `['**/*']` if all git commands fail

#### `setOutputs(changedApps, changedFiles)`
**Signature**: `function setOutputs(changedApps: AppObject[], changedFiles?: string[]): void`

Sets all GitHub Actions output values.

**Parameters**:
- `changedApps` - Array of changed app objects
- `changedFiles` - Array of changed file paths (optional)

**Side Effects**: Calls `core.setOutput()` for each output value

## Error Handling

### Common Error Scenarios

#### Git Issues
- **Missing git history**: Ensure `fetch-depth: 0` in checkout action
- **Invalid base ref**: Action falls back to `HEAD~1` comparison
- **Permission issues**: Ensure proper repository permissions

#### Directory Structure Issues  
- **Missing directories**: Warnings logged, continues with available paths
- **Invalid patterns**: Each pattern processed independently, failures don't block others
- **Permission errors**: Logged as warnings, affected directories skipped

#### Package.json Issues
- **Parse errors**: Logged as warnings, directory skipped
- **Missing files**: Directories without package.json are skipped
- **Invalid JSON**: Parsing errors don't break the entire process

### Debug Information

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

**Debug Output Includes**:
- Pattern processing details
- Directory discovery results
- Package.json parsing status
- App classification reasoning
- File change mapping

**Example Debug Output**:
```
Processing pattern: apps/*
Found 3 directories: portal-dashboard, analytics-app, user-management  
Checking package.json in apps/portal-dashboard
✅ Has Fusion dependencies: @equinor/fusion-framework-cli
✅ Has app scripts: build, start
✅ Classified as Fusion app
```