# Source Code Architecture

This directory contains the modular TypeScript source code for the Fusion Action App Change detection system.

## Directory Structure

```
src/
├── index.ts          # Main entry point and orchestration
├── index.test.ts     # Comprehensive test suite (24 tests)
├── types/
│   └── index.ts      # TypeScript type definitions and interfaces
├── core/
│   ├── git.ts        # Git operations (getBaseRef, getChangedFiles)
│   ├── fusion-app.ts # Fusion app detection and analysis logic
│   └── outputs.ts    # GitHub Actions output handling
└── utils/            # Utility functions (reserved for future use)
```

## Module Responsibilities

### `index.ts`
- Main entry point for the GitHub Action
- Orchestrates the entire detection workflow
- Error handling and logging
- Re-exports all public APIs for testing

### `types/index.ts`
- `FusionApp`: Interface for representing discovered Fusion applications
- `PackageJson`: Type-safe package.json structure
- `ActionsMatrix`: GitHub Actions matrix format
- `GitHubEventPullRequest`: GitHub event structure for PR handling

### `core/git.ts`
- `getBaseRef()`: Determines git reference for comparison (PR base or HEAD~1)
- `getChangedFiles()`: Retrieves changed files using multiple git strategies

### `core/fusion-app.ts`
- `findFusionApps()`: Discovers Fusion apps using configurable glob patterns
- `isFusionApp()`: Classifies packages as apps vs libraries using heuristics
- `findChangedApps()`: Maps changed files to affected Fusion applications

### `core/outputs.ts`
- `setOutputs()`: Sets all GitHub Actions outputs with detection results
- `setErrorOutputs()`: Provides fallback outputs on error conditions
- Handles output formatting and logging

## Testing

All modules are tested through the comprehensive test suite in `index.test.ts`:
- 24 test cases covering all public functions
- Mocked dependencies for isolated unit testing
- Full coverage of error conditions and edge cases

## Build Process

The modular source is bundled into `dist/index.js` using Vite with:
- TypeScript compilation with strict mode
- External Node.js built-ins for GitHub Actions compatibility
- Source maps for debugging
- All dependencies bundled except Node.js core modules