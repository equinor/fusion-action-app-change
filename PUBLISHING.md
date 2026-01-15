# Publishing Guide

## 📦 How to Publish the Fusion App Change Detection Action

### Method 1: GitHub Releases (Start Here)

1. **Prepare for release:**
   ```bash
   # Ensure everything is committed
   git add .
   git commit -m "feat: initial release of fusion-action-app-change"
   git push origin main
   ```

2. **Create a release tag:**
   ```bash
   # Create and push tag
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Create GitHub Release:**
   - Go to: `https://github.com/equinor/fusion-action-app-change/releases/new`
   - Tag: `v1.0.0`
   - Title: `v1.0.0 - Initial Release`
   - Description: Include key features and changes

4. **Users can now use it:**
   ```yaml
   - uses: equinor/fusion-action-app-change@v1.0.0
   # or
   - uses: equinor/fusion-action-app-change@v1
   ```

### Method 2: GitHub Actions Marketplace

1. **Add marketplace metadata to action.yml:**
   ```yaml
   name: 'Fusion App Change Detection'
   description: 'Detect changes in Fusion applications for smart CI/CD deployments'
   author: 'Equinor Fusion Core'
   branding:
     icon: 'git-branch'
     color: 'blue'
   ```

2. **Create release (same as above)**

3. **Publish to Marketplace:**
   - Go to GitHub repository → Actions tab
   - Click "Publish this Action to Marketplace"
   - Fill out marketplace form
   - Submit for review

### Method 3: Internal/Private Usage

Users can reference directly:
```yaml
- uses: equinor/fusion-action-app-change@main
```

## 🏷️ Versioning Strategy

### Major Versions (v1, v2, v3)
- Update major version tag after releases
- Users can pin to `@v1` for automatic minor updates

```bash
# After releasing v1.0.0, v1.1.0, v1.2.0...
git tag -f v1  # Move v1 tag to latest v1.x.x
git push origin v1 --force
```

### Example Release Workflow
```bash
# Release v1.1.0
git tag v1.1.0
git push origin v1.1.0

# Update major version pointer
git tag -f v1
git push origin v1 --force
```

## 📋 Pre-publish Checklist

- [ ] All tests pass (run `npm test`)
- [ ] Documentation is complete
- [ ] Example workflows are tested
- [ ] Action outputs are properly validated
- [ ] Version in package.json is bumped
- [ ] Action.yml has proper branding
- [ ] No sensitive information in code
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