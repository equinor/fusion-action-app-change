# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this project, please follow these steps to responsibly disclose it:

1. **Do not** create a public GitHub issue for the vulnerability.
2. Follow our guideline for Responsible Disclosure Policy at [https://www.equinor.com/about-us/csirt](https://www.equinor.com/about-us/csirt) to report the issue

The following information will help us triage your report more quickly:

- Type of issue (e.g. code injection, command injection, path traversal, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

We prefer all communications to be in English.

## Security Considerations for GitHub Actions

This GitHub Action processes repository files and executes git commands. Please be aware of the following security considerations:

### Input Validation
- The action validates `app-paths` input to prevent directory traversal attacks
- Package.json files are parsed safely with error handling
- Git commands use controlled parameters to prevent command injection

### File System Access
- The action only reads files within the repository workspace
- No files are written or modified by the action
- Directory scanning is limited to specified patterns

### Dependencies
- The action uses minimal dependencies (@actions/core only)
- All dependencies are included in the repository to ensure supply chain security
- Regular security audits are performed on dependencies

### Permissions
- The action requires minimal permissions (contents: read)
- No network requests are made outside of the GitHub Actions environment
- No secrets or sensitive data are accessed or logged

## Known Security Considerations

### Git Command Execution

**Context**: The action executes git commands to determine changed files using `child_process.execSync()`.

**Security Measures**:
- Commands use fixed parameters with controlled inputs
- Base references are validated against expected patterns
- Error handling prevents sensitive information from being logged
- No user input is directly interpolated into git commands

### Package.json Parsing

**Context**: The action parses package.json files to identify Fusion applications.

**Security Measures**:
- JSON parsing is wrapped in try-catch blocks to handle malformed files
- File reading is limited to package.json files in scanned directories
- No code execution or evaluation of package.json contents
- Dependency analysis is read-only and does not install packages

### Directory Traversal Protection

**Context**: The action scans directories based on app-paths patterns.

**Security Measures**:
- Path patterns are validated to prevent traversal outside workspace
- Directory existence is verified before scanning
- Symbolic links are handled safely by Node.js fs operations
- Glob patterns are processed securely without shell expansion

## Best Practices for Users

When using this action in your workflows:

1. **Pin to specific versions** rather than using `@main` in production
2. **Review permissions** - only grant necessary repository access
3. **Validate outputs** before using them in subsequent steps
4. **Monitor for updates** and apply security patches promptly
5. **Use in trusted repositories** - avoid running on untrusted code

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |
| < 0.0.1 | :x:                |

## Security Updates

Security updates will be released as patch versions and communicated through:
- GitHub Security Advisories
- Release notes
- Repository README updates

For critical security issues, we may also:
- Release emergency patches
- Update documentation with mitigation steps
- Notify users through GitHub notifications