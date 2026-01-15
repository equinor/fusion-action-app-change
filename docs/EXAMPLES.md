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

### 2. Conditional Build

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

These examples demonstrate the flexibility and power of the Fusion App Change Detection Action across various CI/CD scenarios, from simple change detection to complex multi-environment deployment pipelines.