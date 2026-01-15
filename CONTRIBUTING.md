# Contributing to Fusion App Change Detection Action

We welcome contributions to the Fusion App Change Detection Action! This guide will help you get started.

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Basic knowledge of GitHub Actions

## 🚀 Getting Started

1. **Fork the repository**
   ```bash
   # Clone your fork
   git clone https://github.com/YOUR_USERNAME/fusion-action-app-change.git
   cd fusion-action-app-change
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test
   ```

## 🧪 Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Edit files in the `scripts/` directory
   - Update tests if needed
   - Update documentation

3. **Test your changes**
   ```bash
   # Run tests
   npm test
   
   # Run linting
   npm run lint
   
   # Format code
   npm run format
   
   # Test locally
   node scripts/index.js
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Use a descriptive title
   - Explain what your PR does
   - Reference any related issues

## 📁 Project Structure

```
fusion-action-app-change/
├── scripts/
│   ├── index.js          # Main action logic
│   └── simple.test.js    # Test suite
├── example-workflows/     # Example workflow files
├── action.yml            # GitHub Action metadata
├── package.json          # Dependencies and scripts
└── README.md            # Documentation
```

## 🧪 Testing

### Unit Tests

⚠️ **Note**: Tests may fail when run in the actual repository during development. This is expected behavior.

The test suite uses mocks and expects controlled environments. When run against the real repository, tests may fail because:
- Git commands return actual file changes instead of mocked data
- Real GitHub context differs from test expectations
- Tests expect specific fake data that doesn't exist in development

This is normal for development work. Tests are designed to run in isolated CI environments.

```bash
# Run all tests (may fail in development - this is expected)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Testing

Test the action in a real repository:

1. Create a test repository with Fusion apps
2. Use the example workflows in `example-workflows/`
3. Test different scenarios:
   - Apps with changes
   - Apps without changes
   - Different directory structures
   - Various package.json configurations

## 📝 Coding Standards

### Code Style
- Use Prettier for formatting: `npm run format`
- Use ESLint for linting: `npm run lint`
- Follow existing code patterns
- Use meaningful variable names
- Add comments for complex logic

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

Examples:
```
feat: add support for multiple app directories
fix: handle missing package.json files gracefully
docs: update README with new configuration options
test: add tests for edge cases in app detection
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description** of the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment details**:
   - Node.js version
   - Operating system
   - Repository structure
6. **Logs** from the GitHub Action run

## 💡 Feature Requests

When requesting features:

1. **Describe the problem** you're trying to solve
2. **Explain your proposed solution**
3. **Provide use cases** and examples
4. **Consider backward compatibility**

## 📦 Releasing

### For Maintainers

1. **Update version** in package.json
2. **Update RELEASES.md** with changes
3. **Create and push tag**:
   ```bash
   git tag -a v0.1.0 -m "v0.1.0 - Description of changes"
   git push --tags
   ```
4. **Create GitHub release** with release notes

### Version Strategy

- **Major** (v1.0.0): Breaking changes
- **Minor** (v0.1.0): New features, backward compatible
- **Patch** (v0.0.1): Bug fixes, backward compatible

## 🤝 Code of Conduct

Please be respectful and constructive in all interactions. We aim to create a welcoming environment for all contributors.

## 📞 Getting Help

- **Issues**: [GitHub Issues](https://github.com/equinor/fusion-action-app-change/issues)
- **Discussions**: [GitHub Discussions](https://github.com/equinor/fusion-action-app-change/discussions)
- **Documentation**: [README.md](README.md)

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

---

Thank you for contributing to the Fusion App Change Detection Action! 🎉