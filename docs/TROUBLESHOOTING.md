# Troubleshooting Guide

## Common Issues

### 1. No Apps Found

**Problem**: Action reports "Found 0 Fusion apps" but you know apps exist.

**Symptoms**:
```
🎯 Found 0 Fusion apps
✨ No Fusion apps changed
```

**Solutions**:

#### Check Directory Structure
```bash
# Verify your app directories exist
ls -la apps/
ls -la packages/

# Look for package.json files
find . -name "package.json" | grep -E "(apps|packages)" | head -10
```

#### Verify Pattern Syntax
```yaml
# ❌ Wrong - searches FOR a directory named 'apps'
app-paths: 'apps'

# ✅ Correct - searches INSIDE the apps directory  
app-paths: 'apps/*'

# ✅ Also correct - multiple patterns
app-paths: 'apps/*,packages/fusion-*'
```

#### Check Package.json Content
```bash
# Verify package.json has Fusion dependencies
cat apps/my-app/package.json | jq '.dependencies, .devDependencies' | grep fusion
```

#### Enable Debug Mode
```yaml
# Add to your workflow or repository secrets
env:
  ACTIONS_STEP_DEBUG: true
```

### 2. Apps Not Being Detected as Changed

**Problem**: Apps exist but aren't reported as changed even when files are modified.

**Symptoms**:
```
🎯 Found 3 Fusion apps
📦 0 apps changed
✨ No Fusion apps changed
```

**Solutions**:

#### Check Git Fetch Depth
```yaml
# ❌ Shallow clone - can't detect changes
- uses: actions/checkout@v4

# ✅ Full history for proper diff
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

#### Verify Base Reference
```bash
# Check what the action is comparing against
echo "Event: $GITHUB_EVENT_NAME"
echo "Ref: $GITHUB_REF"

# For PRs, check the base branch
jq '.pull_request.base.sha' "$GITHUB_EVENT_PATH"
```

#### Manual Git Diff Check
```bash
# Test git diff manually
git diff --name-only HEAD~1 HEAD
git diff --name-only origin/main...HEAD
```

### 3. Test Failures During Development

**Problem**: Tests fail when running `npm test` during local development.

**Symptoms**:
```
 FAIL  scripts/simple.test.js
  ● should return PR base SHA
    Expected: "abc123"
    Received: "main"
  
  ● should return files from git diff
    Expected: ["app1/file.ts", "app2/file.js"]
    Received: ["scripts/simple.test.js"]
```

**This is Expected Behavior**:

The test suite is designed for isolated CI environments and uses mocks that don't match the real development repository:

- **Git commands**: Tests expect fake file lists but get real changes from your working directory
- **GitHub context**: Tests mock PR events and base refs that differ from your local environment  
- **File system**: Tests expect controlled fake data instead of actual repository files

**Solutions**:

1. **Ignore test failures during development** - This is normal and expected
2. **Focus on manual testing**: Use `node scripts/index.js` to test your changes
3. **Test in CI**: Push to a branch and let GitHub Actions run tests in the proper environment
4. **Create isolated test repos**: For thorough testing, create separate test repositories with controlled structures

### 4. Wrong Apps Being Classified

**Problem**: Libraries are detected as apps, or apps are being excluded.

**Symptoms**:
```
# Library incorrectly detected as app
✅ Added app: shared-components at packages/components

# App incorrectly excluded  
❌ Excluded as publishable library
```

**Solutions**:

#### Review Classification Criteria

**Apps Must Have**:
- `@equinor/fusion-*` dependencies
- At least one app indicator:
  - `@equinor/fusion-framework-cli` dependency
  - App scripts (`build`, `start`, etc.)
  - Fusion config (`fusion`/`fusionApp` fields)
  - Private package (`private: true`)

**Libraries Are Excluded If**:
- Have library structure (`main`/`module`/`exports`)
- Are publishable (`private: false` or undefined)
- Lack app scripts and configuration

#### Fix Library Classification
```json
{
  "name": "@company/shared-components",
  "private": false,
  "main": "dist/index.js",
  "dependencies": {
    "@equinor/fusion-components": "^1.0.0"
  }
}
```

#### Fix App Classification
```json
{
  "name": "my-fusion-app", 
  "private": true,
  "scripts": {
    "build": "ffc build",
    "start": "ffc start"
  },
  "dependencies": {
    "@equinor/fusion-framework-cli": "^1.0.0"
  }
}
```

### 4. Performance Issues

**Problem**: Action runs slowly or times out on large repositories.

**Solutions**:

#### Optimize Patterns
```yaml
# ❌ Slow - recursive search  
app-paths: '**/apps/*'

# ✅ Fast - specific patterns
app-paths: 'frontend/apps/*,backend/services/*'
```

#### Limit File Operations
```yaml
# Use targeted patterns instead of scanning everything
app-paths: 'apps/*'  # Only apps directory
# Instead of: 'apps/*,src/*,packages/*,libs/*,services/*'
```

### 5. Git Issues

**Problem**: Git diff commands failing or returning unexpected results.

**Symptoms**:
```
⚠️ Could not determine changed files, assuming all apps may be affected
⚠️ Git diff failed: Command failed
```

**Solutions**:

#### Check Repository State
```bash
# Verify git repository
git status
git log --oneline -5

# Check remote references
git remote -v
git branch -r
```

#### Verify Permissions
```yaml
# Ensure proper token permissions
permissions:
  contents: read
  pull-requests: write  # If commenting on PRs
```

### 6. Output Format Issues

**Problem**: Outputs are empty, malformed, or not usable in subsequent steps.

**Solutions**:

#### Check Output Usage
```yaml
# ❌ Wrong - treating string as boolean
if: steps.detect.outputs.has-changes

# ✅ Correct - comparing string values  
if: steps.detect.outputs.has-changes == 'true'
```

#### Validate JSON Outputs
```yaml
- name: Debug outputs
  run: |
    echo "Matrix:"
    echo '${{ steps.detect.outputs.matrix }}' | jq .
    
    echo "Changed apps:"
    echo '${{ steps.detect.outputs.changed-apps }}' | jq .
```

## Debug Workflows

### Full Debug Workflow

```yaml
name: Debug Fusion App Detection

on:
  workflow_dispatch:
    inputs:
      patterns:
        description: 'App patterns to test'
        required: false
        default: 'apps/*'

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Repository analysis
        run: |
          echo "=== Repository Structure ==="
          find . -type f -name "package.json" | head -20
          
          echo "\n=== Git Status ==="
          git status
          git log --oneline -5
          
          echo "\n=== Event Context ==="
          echo "Event: $GITHUB_EVENT_NAME"
          echo "Ref: $GITHUB_REF"  
          echo "Actor: $GITHUB_ACTOR"
          
          if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
            echo "\n=== PR Context ==="
            jq '.pull_request.base.sha, .pull_request.head.sha' "$GITHUB_EVENT_PATH"
          fi
      
      - name: Test git diff
        run: |
          echo "=== Git Diff Tests ==="
          
          echo "Strategy 1: HEAD~1...HEAD"
          git diff --name-only HEAD~1...HEAD || echo "Failed"
          
          echo "\nStrategy 2: HEAD~1 HEAD"
          git diff --name-only HEAD~1 HEAD || echo "Failed"
          
          if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
            BASE_SHA=$(jq -r '.pull_request.base.sha' "$GITHUB_EVENT_PATH")
            echo "\nStrategy 3: ${BASE_SHA}...HEAD"
            git diff --name-only "${BASE_SHA}...HEAD" || echo "Failed"
          fi
      
      - name: Manual app discovery
        run: |
          echo "=== Manual App Discovery ==="
          
          patterns="${{ github.event.inputs.patterns }}"
          IFS=',' read -ra PATTERNS <<< "$patterns"
          
          for pattern in "${PATTERNS[@]}"; do
            echo "\nPattern: $pattern"
            
            if [[ $pattern == *"*" ]]; then
              base_path=${pattern%/*}
              echo "  Base path: $base_path"
              
              if [ -d "$base_path" ]; then
                echo "  Directories:"
                ls -la "$base_path" | grep "^d" || echo "    None found"
                
                for dir in "$base_path"/*/; do
                  if [ -d "$dir" ] && [ -f "${dir}package.json" ]; then
                    echo "    Checking: $dir"
                    
                    name=$(jq -r '.name // "unnamed"' "${dir}package.json" 2>/dev/null)
                    echo "      Name: $name"
                    
                    fusion_deps=$(jq -r '[(.dependencies // {}), (.devDependencies // {})] | add | to_entries | map(select(.key | startswith("@equinor/fusion"))) | .[].key' "${dir}package.json" 2>/dev/null)
                    if [ -n "$fusion_deps" ]; then
                      echo "      Fusion deps: $fusion_deps"
                    else
                      echo "      Fusion deps: None"
                    fi
                  fi
                done
              else
                echo "  Directory does not exist"
              fi
            fi
          done
      
      - name: Run action with debug
        id: detect
        uses: ./
        with:
          app-paths: ${{ github.event.inputs.patterns }}
        env:
          ACTIONS_STEP_DEBUG: true
      
      - name: Analyze outputs
        run: |
          echo "=== Action Outputs ==="
          echo "has-changes: ${{ steps.detect.outputs.has-changes }}"
          echo "changed-apps-count: ${{ steps.detect.outputs.changed-apps-count }}"
          echo "summary: ${{ steps.detect.outputs.summary }}"
          echo "changed-app-names: ${{ steps.detect.outputs.changed-app-names }}"
          
          echo "\n=== JSON Outputs ==="
          echo "changed-apps:"
          echo '${{ steps.detect.outputs.changed-apps }}' | jq . || echo "Invalid JSON"
          
          echo "\nmatrix:"
          echo '${{ steps.detect.outputs.matrix }}' | jq . || echo "Invalid JSON"
          
          echo "\nchanged-files:"
          echo '${{ steps.detect.outputs.changed-files }}' | jq . | head -20 || echo "Invalid JSON"
```

### Quick Validation Script

```bash
#!/bin/bash
# validate-setup.sh - Quick validation script

echo "🔍 Validating Fusion App Detection Setup"
echo

# Check directory structure
echo "📂 Directory Structure:"
for pattern in "apps/*" "packages/*" "services/*"; do
  base_path=${pattern%/*}
  if [ -d "$base_path" ]; then
    echo "  ✅ $base_path exists"
    count=$(find "$base_path" -maxdepth 1 -type d | wc -l)
    echo "     Contains $((count-1)) subdirectories"
  else
    echo "  ❌ $base_path not found"
  fi
done
echo

# Check for Fusion apps
echo "🎯 Fusion App Analysis:"
find . -name "package.json" -path "./apps/*" -o -path "./packages/*" -o -path "./services/*" | while read -r pkg; do
  dir=$(dirname "$pkg")
  name=$(jq -r '.name // "unnamed"' "$pkg" 2>/dev/null)
  
  fusion_deps=$(jq -r '[(.dependencies // {}), (.devDependencies // {})] | add | keys | map(select(. | startswith("@equinor/fusion"))) | length' "$pkg" 2>/dev/null)
  
  if [ "$fusion_deps" -gt 0 ]; then
    echo "  ✅ $name ($dir)"
    
    # Check app indicators
    has_cli=$(jq -r 'has("dependencies") and (.dependencies | has("@equinor/fusion-framework-cli"))' "$pkg" 2>/dev/null)
    has_scripts=$(jq -r '.scripts // {} | keys | map(select(. | test("build|start"))) | length > 0' "$pkg" 2>/dev/null)
    has_config=$(jq -r 'has("fusion") or has("fusionApp")' "$pkg" 2>/dev/null)
    is_private=$(jq -r '.private == true' "$pkg" 2>/dev/null)
    
    echo "     CLI: $has_cli, Scripts: $has_scripts, Config: $has_config, Private: $is_private"
  else
    echo "  ❌ $name ($dir) - No Fusion dependencies"
  fi
done
echo

# Check git status
echo "📋 Git Status:"
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "  ✅ Git repository detected"
  echo "     Branch: $(git branch --show-current)"
  echo "     Commits: $(git rev-list --count HEAD)"
else
  echo "  ❌ Not a git repository"
fi
echo

echo "🎉 Validation complete!"
```

## Getting Help

If you're still experiencing issues:

1. **Enable Debug Logging**: Set `ACTIONS_STEP_DEBUG: true`
2. **Check Examples**: Review [examples documentation](EXAMPLES.md)
3. **Validate Configuration**: Use the [configuration guide](CONFIGURATION.md) 
4. **File an Issue**: Create a [GitHub issue](https://github.com/equinor/fusion-action-app-change/issues) with:
   - Your workflow YAML
   - Repository structure (anonymized)
   - Debug output logs
   - Expected vs actual behavior
