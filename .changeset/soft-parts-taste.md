---
"fusion-action-app-change": patch
---

**Security Fix**: Prevent command injection vulnerability in git diff commands

Fixed unsafe shell command construction in `getChangedFiles` function that could allow command injection attacks through the `baseRef` parameter. The fix includes:

- Added `shell-quote` dependency for safe argument escaping
- Replaced unsafe string interpolation with `shell-quote.quote()` 
- Added comprehensive test coverage to verify protection against malicious input

This addresses the CodeQL security alert for "Unsafe shell command constructed from library input" while maintaining full functionality.
