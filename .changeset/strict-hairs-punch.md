---
"fusion-action-app-change": minor
---

Major refactoring and modernization of the GitHub Action:

**🏗️ Architecture Improvements:**
- Migrated from `scripts/` to `src/` directory structure  
- Split monolithic code into focused modules (git, fusion-app, outputs, types)
- Converted JavaScript to TypeScript with strict configuration
- Replaced Jest with Vitest for testing consistency

**🔧 Build & Tooling:**
- Switched from @vercel/ncc to Vite for bundling (aligns with project standards)
- Added comprehensive TypeScript type definitions
- Updated all configurations for new modular structure
- Enhanced CI to validate dist files are up-to-date

**✅ Quality & Testing:**
- All 24 tests passing with improved Vitest mocking
- Better code organization for maintainability and testability
- Updated documentation with implementation details
- Maintained 100% backward compatibility

**🐛 Fixes:**
- Resolved "Cannot find module '@actions/core'" issue via proper dependency bundling
- Fixed CI workflow to ensure dist files are always current
- Improved error handling and output management
