# Examples & Use Cases

## Basic Examples

### 1. Simple Change Detection

```yaml
name: Detect App Changes

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for git diff
      
      - name: Detect changes
        id: changes
        uses: equinor/fusion-action-app-change@v1
      
      - name: Print results
        run: |
          echo "Has changes: ${{ steps.changes.outputs.has-changes }}"
          echo "Summary: ${{ steps.changes.outputs.summary }}"
          echo "Changed apps: ${{ steps.changes.outputs.changed-app-names }}"
```

### 2. Dependency Tracking (Recommended)

Enable automatic workspace discovery and dependency tracking:

```yaml
name: Smart Build with Dependency Tracking

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      matrix: ${{ steps.detect.outputs.matrix }}
      summary: ${{ steps.detect.outputs.summary }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes with dependency tracking
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          enable-dependency-tracking: 'true'
      
      - name: Display detection results
        run: |
          echo "📋 Summary: ${{ steps.detect.outputs.summary }}"
          echo "📦 Changed apps: ${{ steps.detect.outputs.changed-app-names }}"
          echo "🔗 Dependency-affected apps: ${{ steps.detect.outputs.affected-by-dependencies }}"
          echo "📚 Changed libraries: ${{ steps.detect.outputs.changed-libraries }}"

  build-affected-apps:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build ${{ matrix.name }}
        run: |
          echo "Building ${{ matrix.name }} (changed due to: ${{ matrix.changeReason }})"
          cd ${{ matrix.path }}
          npm run build
```

**Key Benefits:**
- ✅ **Zero Configuration**: Automatically discovers all packages
- ✅ **Smart Dependencies**: Supports `workspace:*`, `file:`, and relative paths
- ✅ **Transitive Detection**: Library A → Library B → App C
- ✅ **Build Optimization**: Only builds what's actually affected
      matrix: ${{ steps.detect.outputs.matrix }}
      changed-libraries: ${{ steps.detect.outputs.changed-libraries }}
      affected-by-deps: ${{ steps.detect.outputs.affected-by-dependencies }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes with dependencies
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'apps/*'
          library-paths: 'packages/*,libs/*'
          enable-dependency-tracking: 'true'
      
      - name: Print dependency analysis
        run: |
          echo "Summary: ${{ steps.detect.outputs.summary }}"
          echo "Changed libraries: ${{ steps.detect.outputs.changed-libraries }}"
          echo "Apps affected by dependencies: ${{ steps.detect.outputs.affected-by-dependencies }}"

  build-apps:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build app (${{ matrix.changeReason }})
        run: |
          echo "Building ${{ matrix.name }} due to ${{ matrix.changeReason }} changes"
          cd ${{ matrix.path }}
          npm run build
```

**What this example does:**
- Detects changes in both apps (`apps/*`) and libraries (`packages/*`, `libs/*`)
- When a library changes, automatically includes dependent apps
- Shows change reason in build logs (direct vs dependency)
- Only builds apps that are actually affected

### 3. Conditional Build

```yaml
name: Build Only Changed Apps

on:
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'apps/*,services/*'

  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.path }}/package-lock.json
      
      - name: Install dependencies
        run: |
          cd ${{ matrix.path }}
          npm ci
      
      - name: Build ${{ matrix.name }}
        run: |
          cd ${{ matrix.path }}
          npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.name }}-build
          path: ${{ matrix.path }}/dist/
```

## Advanced Use Cases

### 3. Multi-Environment Deployment

```yaml
name: Deploy to Multiple Environments

on:
  push:
    branches: [main, develop, 'release/*']

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      changed-apps: ${{ steps.detect.outputs.changed-apps }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'apps/*'

  deploy-dev:
    needs: detect-changes
    if: |
      needs.detect-changes.outputs.has-changes == 'true' &&
      github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: development
    
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy ${{ matrix.name }} to Dev
        run: |
          echo "Deploying ${{ matrix.name }} to development"
          # Add deployment commands here

  deploy-staging:
    needs: detect-changes
    if: |
      needs.detect-changes.outputs.has-changes == 'true' &&
      startsWith(github.ref, 'refs/heads/release/')
    runs-on: ubuntu-latest
    environment: staging
    
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy ${{ matrix.name }} to Staging
        run: |
          echo "Deploying ${{ matrix.name }} to staging"
          # Add deployment commands here

  deploy-prod:
    needs: detect-changes
    if: |
      needs.detect-changes.outputs.has-changes == 'true' &&
      github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy ${{ matrix.name }} to Production
        run: |
          echo "Deploying ${{ matrix.name }} to production"
          # Add deployment commands here
```

### 4. PR Comments with Change Summary

```yaml
name: PR Change Analysis

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  analyze-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'apps/*,packages/app-*'
      
      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const changedApps = JSON.parse('${{ steps.detect.outputs.changed-apps }}');
            const changedFiles = JSON.parse('${{ steps.detect.outputs.changed-files }}');
            const summary = '${{ steps.detect.outputs.summary }}';
            
            let comment = '## 🚀 Fusion App Change Analysis\n\n';
            comment += `**Summary:** ${summary}\n\n`;
            
            if (changedApps.length === 0) {
              comment += '✅ No Fusion apps were changed in this PR.\n\n';
              comment += 'The following files were modified:\n';
              const otherFiles = changedFiles.slice(0, 10);
              for (const file of otherFiles) {
                comment += `- \`${file}\`\n`;
              }
              if (changedFiles.length > 10) {
                comment += `- ... and ${changedFiles.length - 10} more files\n`;
              }
            } else {
              comment += '### Changed Apps\n\n';
              for (const app of changedApps) {
                comment += `#### 📱 ${app.name}\n`;
                comment += `- **Path:** \`${app.path}\`\n`;
                
                // Get files for this specific app
                const appFiles = changedFiles.filter(file => 
                  file.startsWith(app.path + '/')
                );
                
                if (appFiles.length > 0) {
                  comment += `- **Files changed:** ${appFiles.length}\n`;
                  const displayFiles = appFiles.slice(0, 5);
                  for (const file of displayFiles) {
                    comment += `  - \`${file}\`\n`;
                  }
                  if (appFiles.length > 5) {
                    comment += `  - ... and ${appFiles.length - 5} more files\n`;
                  }
                }
                comment += '\n';
              }
            }
            
            comment += '---\n';
            comment += '*This analysis was generated by the Fusion App Change Detection Action*';
            
            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            
            const existingComment = comments.find(c => 
              c.user.type === 'Bot' && c.body.includes('Fusion App Change Analysis')
            );
            
            if (existingComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existingComment.id,
                body: comment
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: comment
              });
            }
```

### 5. Selective Testing Based on Changes

```yaml
name: Smart Testing

on:
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      changed-apps: ${{ steps.detect.outputs.changed-apps }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1

  unit-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
      fail-fast: false
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.path }}/package-lock.json
      
      - name: Install dependencies
        run: |
          cd ${{ matrix.path }}
          npm ci
      
      - name: Run unit tests
        run: |
          cd ${{ matrix.path }}
          npm run test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ${{ matrix.path }}/coverage/lcov.info
          flags: ${{ matrix.name }}

  integration-tests:
    needs: [detect-changes, unit-tests]
    if: |
      needs.detect-changes.outputs.has-changes == 'true' &&
      contains(needs.detect-changes.outputs.changed-apps, 'api-gateway')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run integration tests
        run: |
          echo "Running integration tests because API gateway changed"
          # Add integration test commands

  e2e-tests:
    needs: [detect-changes, unit-tests]
    if: |
      needs.detect-changes.outputs.has-changes == 'true' &&
      (contains(needs.detect-changes.outputs.changed-apps, 'portal-frontend') ||
       contains(needs.detect-changes.outputs.changed-apps, 'user-management'))
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run E2E tests
        run: |
          echo "Running E2E tests because frontend apps changed"
          # Add E2E test commands
```

### 6. Complex Monorepo with Multiple App Types

```yaml
name: Multi-Type App Detection

on:
  push:
    branches: [main, develop]

jobs:
  detect-frontend:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect frontend changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'frontend/apps/*,packages/app-*'

  detect-backend:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect backend changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'backend/services/*,backend/apps/*'

  detect-mobile:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.detect.outputs.has-changes }}
      matrix: ${{ steps.detect.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Detect mobile changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          app-paths: 'mobile/apps/*'

  build-frontend:
    needs: detect-frontend
    if: needs.detect-frontend.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    
    strategy:
      matrix: ${{ fromJson(needs.detect-frontend.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build frontend app
        run: |
          cd ${{ matrix.path }}
          npm ci
          npm run build
          
      - name: Deploy to CDN
        run: |
          echo "Deploying ${{ matrix.name }} to CDN"

  build-backend:
    needs: detect-backend
    if: needs.detect-backend.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    
    strategy:
      matrix: ${{ fromJson(needs.detect-backend.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build backend service
        run: |
          cd ${{ matrix.path }}
          npm ci
          npm run build
          
      - name: Build Docker image
        run: |
          cd ${{ matrix.path }}
          docker build -t ${{ matrix.name }}:${{ github.sha }} .
          
      - name: Deploy to cluster
        run: |
          echo "Deploying ${{ matrix.name }} to Kubernetes"

  build-mobile:
    needs: detect-mobile
    if: needs.detect-mobile.outputs.has-changes == 'true'
    runs-on: macos-latest
    
    strategy:
      matrix: ${{ fromJson(needs.detect-mobile.outputs.matrix) }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build mobile app
        run: |
          cd ${{ matrix.path }}
          npm ci
          npx react-native run-ios --configuration Release
```

## Advanced Dependency Tracking Examples

### 1. Comprehensive Workspace Discovery

Automatically discover all packages without configuration:

```yaml
name: Zero-Config Workspace Build

on:
  pull_request:
    branches: [main]

jobs:
  smart-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Auto-discover and detect changes
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          enable-dependency-tracking: 'true'
          # No app-paths needed - auto-discovers entire workspace
      
      - name: Display discovery results
        run: |
          echo "📦 Discovered packages: ${{ steps.detect.outputs.total-packages }}"
          echo "🔗 Apps with dependencies: ${{ steps.detect.outputs.apps-with-dependencies }}"
          echo "📚 Libraries found: ${{ steps.detect.outputs.libraries-found }}"
          echo "🎯 Affected by library changes: ${{ steps.detect.outputs.affected-by-dependencies }}"
```

### 2. Multi-Linking Method Support

Handle different types of local dependencies:

```yaml
name: Multi-Link Dependency Detection

# Supports all these local dependency types in package.json:
# {
#   "dependencies": {
#     "@company/ui": "workspace:*",           // Workspace protocol
#     "@company/utils": "workspace:^1.0.0",   // Workspace with version
#     "shared-lib": "file:../packages/lib",   // File protocol
#     "local-tool": "../tools/build-tool",    // Relative path
#     "internal": "git+file:../internal"      // Git file protocol
#   }
# }

on:
  push:
    branches: [develop, main]

jobs:
  dependency-tracking:
    runs-on: ubuntu-latest
    outputs:
      summary: ${{ steps.detect.outputs.summary }}
      dependency-chain: ${{ steps.detect.outputs.dependency-chain }}
      
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Comprehensive dependency analysis
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          enable-dependency-tracking: 'true'
      
      - name: Analyze dependency chains
        run: |
          echo "🔄 Dependency Analysis Summary:"
          echo "${{ steps.detect.outputs.summary }}"
          echo ""
          echo "📊 Detailed breakdown:"
          echo "• Changed apps (direct): ${{ steps.detect.outputs.changed-app-names }}"
          echo "• Changed libraries: ${{ steps.detect.outputs.changed-libraries }}"
          echo "• Apps affected by deps: ${{ steps.detect.outputs.affected-by-dependencies }}"
          
  build-with-reasoning:
    needs: dependency-tracking
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.dependency-tracking.outputs.matrix) }}
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Build with change reason
        run: |
          echo "🏗️ Building: ${{ matrix.name }}"
          echo "📍 Location: ${{ matrix.path }}"
          echo "🔍 Reason: ${{ matrix.changeReason }}"
          echo "📦 Type: ${{ matrix.type }}"
          
          cd "${{ matrix.path }}"
          
          # Different build strategy based on change reason
          if [[ "${{ matrix.changeReason }}" == "direct" ]]; then
            echo "Direct changes detected - full rebuild"
            npm ci
            npm run build
            npm run test
          else
            echo "Dependency changes detected - dependency-safe rebuild"
            npm ci
            npm run build
          fi
```

### 3. Transitive Dependency Detection

Handle complex dependency chains:

```yaml
# Example: Library A → Library B → App C
# When Library A changes, both Library B and App C should rebuild

name: Transitive Dependency Builds

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze-impact:
    runs-on: ubuntu-latest
    outputs:
      impact-summary: ${{ steps.detect.outputs.summary }}
      has-transitive: ${{ steps.detect.outputs.has-transitive-dependencies }}
      
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Deep dependency analysis
        id: detect
        uses: equinor/fusion-action-app-change@v1
        with:
          enable-dependency-tracking: 'true'
      
      - name: Create impact report
        uses: actions/github-script@v7
        with:
          script: |
            const summary = `${{ steps.detect.outputs.summary }}`;
            const changedLibs = `${{ steps.detect.outputs.changed-libraries }}`;
            const affectedApps = `${{ steps.detect.outputs.affected-by-dependencies }}`;
            
            const body = `
            ## 🔄 Dependency Impact Analysis
            
            ${summary}
            
            ### 📚 Changed Libraries
            ${changedLibs || 'None'}
            
            ### 🎯 Affected Applications
            ${affectedApps || 'None'}
            
            ### 🔗 Dependency Chain Analysis
            This PR affects applications through dependency relationships. Review the build matrix to understand the impact scope.
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  conditional-builds:
    needs: analyze-impact
    runs-on: ubuntu-latest
    if: needs.analyze-impact.outputs.has-transitive == 'true'
    strategy:
      matrix: ${{ fromJson(needs.analyze-impact.outputs.matrix) }}
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Smart build based on dependency depth
        run: |
          echo "Building ${{ matrix.name }} (type: ${{ matrix.type }})"
          cd "${{ matrix.path }}"
          
          # Optimize build based on change type and dependency depth
          if [[ "${{ matrix.changeReason }}" == "direct" ]]; then
            echo "🎯 Direct changes - comprehensive build"
            npm ci
            npm run lint
            npm run test:unit
            npm run build
            npm run test:integration
          elif [[ "${{ matrix.type }}" == "library" ]]; then
            echo "📚 Library dependency change - focused rebuild"
            npm ci
            npm run build
            npm run test:unit
          else
            echo "🔄 App dependency change - dependency update build"
            npm ci
            npm run build
          fi
```

These examples demonstrate the flexibility and power of the Fusion App Change Detection Action across various CI/CD scenarios, from simple change detection to complex multi-environment deployment pipelines with comprehensive dependency tracking.