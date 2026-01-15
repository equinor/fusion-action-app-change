# Configuration Guide

## Basic Configuration

The Fusion App Change Detection Action works out-of-the-box with zero configuration for most standard repository structures. However, it offers flexible configuration options for complex monorepos and custom setups.

## Input Parameters

### `app-paths`

The primary configuration parameter that tells the action where to find your Fusion applications.

#### Default Behavior (No Configuration)

```yaml
- uses: equinor/fusion-action-app-change@v1
  # No configuration needed - uses intelligent defaults
```

**Auto-detection Strategy**:
1. Searches for common app directory patterns: `apps/*`, `packages/*`, `src/*`
2. Validates each directory using Fusion app classification logic
3. Excludes libraries and non-app packages automatically

#### Single Directory Pattern

```yaml
- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: 'apps/*'
```

**Pattern Types**:
- `apps/*` - Searches inside the `apps` directory for subdirectories
- `apps` - Searches the `apps` directory itself (treats as single app)

#### Multiple Directory Patterns

```yaml
- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: 'apps/*,packages/fusion-apps/*,services/*'
```

**Comma-separated list** of patterns to search multiple locations.

#### Advanced Patterns

```yaml
- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: 'frontend/apps/*,backend/services/*,packages/app-*/*'
```

**Complex Patterns**:
- `packages/app-*/*` - Nested directories with naming convention
- `**/apps/*` - Recursive search (use carefully on large repos)
- `src/applications/*` - Custom application directory naming

#### JSON Array Format

```yaml
- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: |
      [
        "apps/*",
        "packages/fusion-apps/*", 
        "services/frontend/*"
      ]
```

**Use Cases**:
- Complex pattern lists
- Dynamic pattern generation
- Programmatic configuration

## Repository Structure Examples

### Standard Monorepo

```
my-fusion-monorepo/
├── apps/
│   ├── portal-dashboard/     # ✅ Detected
│   │   ├── package.json
│   │   └── src/
│   ├── analytics-app/        # ✅ Detected  
│   │   ├── package.json
│   │   └── src/
│   └── user-management/      # ✅ Detected
│       ├── package.json
│       └── src/
├── packages/
│   ├── shared-components/    # ❌ Excluded (library)
│   │   ├── package.json      # has "main": "dist/index.js"
│   │   └── src/
│   └── common-utils/         # ❌ Excluded (library)
└── docs/
```

**Configuration**:
```yaml
app-paths: 'apps/*'  # Default would also work
```

### Complex Multi-Domain Monorepo

```
enterprise-fusion-apps/
├── domains/
│   ├── hse/
│   │   ├── safety-dashboard/     # ✅ App
│   │   └── incident-tracker/     # ✅ App  
│   ├── operations/
│   │   ├── drilling-monitor/     # ✅ App
│   │   └── production-dashboard/ # ✅ App
│   └── finance/
│       └── cost-tracker/         # ✅ App
├── shared/
│   ├── components/               # ❌ Library
│   └── utilities/                # ❌ Library
└── infrastructure/
    └── deployment-tools/
```

**Configuration**:
```yaml
app-paths: 'domains/*/*'
```

### Mixed Application Types

```
fusion-workspace/
├── frontend/
│   ├── apps/
│   │   ├── main-portal/          # ✅ React app
│   │   └── admin-panel/          # ✅ React app
│   └── libraries/
│       └── ui-components/        # ❌ Library
├── backend/
│   └── services/
│       ├── api-gateway/          # ✅ If has fusion deps
│       └── auth-service/         # ✅ If has fusion deps  
└── mobile/
    └── fusion-mobile-app/        # ✅ If has fusion deps
```

**Configuration**:
```yaml
app-paths: 'frontend/apps/*,backend/services/*,mobile/*'
```

### Workspace with Naming Conventions

```
my-company-apps/
├── apps/
│   ├── app-portal-v2/            # ✅ App
│   ├── app-analytics/            # ✅ App
│   └── lib-shared-hooks/         # ❌ Library (naming + structure)
├── packages/
│   ├── app-shell/                # ✅ App (if has CLI/scripts)
│   ├── component-library/        # ❌ Library
│   └── fusion-utilities/         # ❌ Library
└── tools/
    └── build-scripts/            # ❌ Tooling
```

**Configuration**:
```yaml
app-paths: 'apps/app-*,packages/app-*'
```

## App Classification Rules

The action uses sophisticated logic to distinguish between **deployable apps** and **shared libraries**.

### Fusion App Criteria

A directory is classified as a Fusion app if it meets **all** of these:

#### 1. Has Fusion Dependencies
Must contain at least one `@equinor/fusion-*` dependency in `package.json`:

```json
{
  "dependencies": {
    "@equinor/fusion-framework": "^1.0.0"
  }
}
```

#### 2. Has App Indicators
Must have **at least one** of these indicators:

##### CLI-Based Apps
```json
{
  "dependencies": {
    "@equinor/fusion-framework-cli": "^1.0.0"
  },
  "scripts": {
    "build": "ffc build",
    "start": "ffc start"
  }
}
```

##### Configured Apps  
```json
{
  "fusion": {
    "appKey": "my-app",
    "name": "My Fusion App"
  }
}
```

##### Script-Based Apps
```json
{
  "scripts": {
    "build": "webpack --mode production",
    "start": "webpack serve",
    "app:build": "fusion-cli build"
  }
}
```

##### Private Apps
```json
{
  "private": true,
  "dependencies": {
    "@equinor/fusion-framework": "^1.0.0"
  }
}
```

### Library Exclusion Rules

Packages are **excluded** as libraries if:

#### Publishable Library Structure
```json
{
  \"name\": \"@company/fusion-components\",
  \"main\": \"dist/index.js\",
  \"module\": \"dist/index.esm.js\",  
  \"private\": false,
  \"dependencies\": {
    \"@equinor/fusion-framework\": \"^1.0.0\"
  }
}
```

**Exclusion Logic**: Has library structure (`main`/`module`/`exports`) AND not private AND lacks app scripts/config.

#### Development Tools
```json
{
  \"name\": \"build-tools\",
  \"bin\": {
    \"fusion-build\": \"./bin/build.js\"
  }
}
```

**Note**: Packages in typical library directories (`packages/`, `libs/`, `tools/`) are subject to stricter validation.

## Advanced Configuration Scenarios

### Conditional Patterns Based on Repository

```yaml
# Different patterns for different repo types
- name: Configure app paths
  id: config
  run: |
    if [ -d \"frontend/apps\" ]; then
      echo \"app-paths=frontend/apps/*,backend/services/*\" >> $GITHUB_OUTPUT
    else
      echo \"app-paths=apps/*\" >> $GITHUB_OUTPUT
    fi

- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: ${{ steps.config.outputs.app-paths }}
```

### Environment-Specific Apps

```yaml
# Only check production apps on main branch
- uses: equinor/fusion-action-app-change@v1
  with:
    app-paths: ${{ github.ref == 'refs/heads/main' && 'production-apps/*' || 'apps/*,staging-apps/*' }}
```

### Matrix-Based Multi-Pattern Detection

```yaml
strategy:
  matrix:
    pattern:
      - 'frontend/apps/*'
      - 'backend/services/*' 
      - 'mobile/apps/*'

steps:
  - uses: equinor/fusion-action-app-change@v1
    id: detect-${{ strategy.job-index }}
    with:
      app-paths: ${{ matrix.pattern }}
```

## Troubleshooting Configuration

### Pattern Not Finding Apps

**Issue**: `Found 0 Fusion apps`

**Solutions**:

1. **Check Directory Exists**:
   ```bash
   ls -la apps/  # Verify directories exist
   ```

2. **Verify Pattern Syntax**:
   ```yaml
   # ❌ Wrong - searches FOR directory named 'apps'  
   app-paths: 'apps'
   
   # ✅ Correct - searches INSIDE apps directory
   app-paths: 'apps/*'
   ```

3. **Check Package.json**:
   ```bash
   # Verify package.json exists and is valid
   cat apps/my-app/package.json | jq .
   ```

4. **Enable Debug Logging**:
   ```yaml
   # Add to repository secrets
   ACTIONS_STEP_DEBUG: true
   ```

### Apps Being Excluded

**Issue**: Apps found but classified as libraries

**Debug Steps**:

1. **Check Dependencies**:
   ```json
   {
     "dependencies": {
       // Must have @equinor/fusion-* dependency
       "@equinor/fusion-framework": "^1.0.0"
     }
   }
   ```

2. **Verify App Indicators**:
   ```json
   {
     // Need at least one of these:
     "dependencies": { "@equinor/fusion-framework-cli": "*" },
     "scripts": { "build": "...", "start": "..." },
     "fusion": { "appKey": "..." },
     "private": true
   }
   ```

3. **Check Library Exclusions**:
   ```json
   {
     // These indicate library (will be excluded):
     "main": "dist/index.js",
     "module": "dist/index.esm.js", 
     "exports": { ".": "./dist/index.js" },
     "private": false  // + library structure
   }
   ```

### Performance Optimization

**Large Repositories**: Use specific patterns instead of recursive searches:

```yaml
# ❌ Slow on large repos
app-paths: '**/apps/*'

# ✅ Fast and specific  
app-paths: 'frontend/apps/*,backend/services/*,mobile/apps/*'
```

**Pattern Ordering**: Put most common patterns first:

```yaml
# ✅ Optimized order
app-paths: 'apps/*,packages/apps/*,services/*'
```