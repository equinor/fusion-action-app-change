# Architecture Documentation

## Overview

The Fusion App Change Detection Action has been redesigned as a modular, workspace-aware system that intelligently identifies changes in Fusion applications and their dependencies. The architecture emphasizes simplicity, reliability, and comprehensive dependency tracking.

## Implementation Architecture

### Source Code Organization

The action is implemented in TypeScript using a modular architecture for maintainability and testability:

```
src/
├── index.ts              # Main orchestration and entry point
├── types/index.ts        # TypeScript type definitions
├── core/
│   ├── git.ts           # Git operations and diff analysis
│   ├── fusion-app.ts    # App discovery and classification  
│   └── outputs.ts       # GitHub Actions output handling
└── utils/               # Utility functions (reserved)
```

**Module Responsibilities**:
- **index.ts**: Main orchestration, error handling, re-exports for testing
- **types/**: All TypeScript interfaces (FusionApp, PackageJson, etc.)
- **core/git.ts**: Base reference detection and file change analysis
- **core/fusion-app.ts**: App pattern matching and classification logic
- **core/outputs.ts**: GitHub Actions output formatting and error handling

**Build Process**: The modular source is bundled into `dist/index.js` using Vite with TypeScript compilation, external Node.js built-ins, and all dependencies included for GitHub Actions compatibility.

## High-Level Architecture

```mermaid
graph TB
    subgraph "GitHub Actions Runtime"
        IP["🔧 Input Parser<br/>• app-paths<br/>• enable-dependency-tracking<br/>• token"]
        WD["🔍 Workspace Discovery<br/>• Recursive Package Scan<br/>• Auto Classification<br/>• Dependency Analysis"]
        CD["📊 Change Detection<br/>• Git Analysis<br/>• App Discovery<br/>• Dependency Impact"]
        OG["📤 Output Generator<br/>• JSON Results<br/>• Matrix Format<br/>• Summary Reports"]
        
        IP --> WD
        WD --> CD
        CD --> OG
    end
    
    subgraph "File System & Git Layer"
        WF["📂 Workspace Files<br/>• package.json files<br/>• Directory structure<br/>• App manifests<br/>• Dependencies"]
        GR["📜 Git Repository<br/>• Commit history<br/>• Diff analysis<br/>• Branch comparisons"]
    end
    
    WD --> WF
    CD --> WF
    CD --> GR
```

## Modular Architecture (v2.0)

The action has been refactored into focused, testable modules:

### Core Modules

```
scripts/
├── index.js                     # Main orchestration
├── lib/
│   ├── package-discovery.js     # Workspace scanning & app discovery
│   ├── package-classification.js # App vs Library classification
│   ├── dependency-graph.js      # Dependency analysis & graph building
│   └── change-detection.js      # Git analysis & change detection
└── __tests__/
    ├── simple.test.js           # Legacy compatibility tests
    ├── dependency-tracking.test.js # Dependency features tests
    └── enhanced-dependency-detection.test.js # Advanced dependency tests
```

**Purpose**: Determines what files have changed between commits/branches

**Components**:
- **Reference Strategy**: Smart base-ref selection (PR base, HEAD~1, etc.)
- **Diff Calculator**: Executes git diff commands with fallback strategies
- **File Path Normalizer**: Standardizes file paths for consistent matching

**Git Strategies** (executed in order):
```mermaid
flowchart TD
    A["Start Git Diff"] --> B["Strategy 1: baseRef...HEAD"]
    B -->|Success| E["Return Files"]
    B -->|Fail| C["Strategy 2: baseRef HEAD"]
    C -->|Success| E
    C -->|Fail| D["Strategy 3: HEAD~1 HEAD"]
    D -->|Success| E
    D -->|Fail| F["Fallback: ['**/*']"]
    F --> E
```

### 3. App Discovery Engine

**Purpose**: Finds and classifies Fusion applications in the workspace

**Discovery Flow**:
```mermaid
flowchart LR
    A["Pattern Input"] --> B["Directory Scanning"]
    B --> C["package.json Parsing"]
    C --> D["Classification"]
    D --> E["App Registry"]
```

**Components**:
- **Pattern Processor**: Handles glob patterns and direct paths
- **Directory Scanner**: Recursively finds candidate directories
- **Package Parser**: Safely parses package.json files
- **App Classifier**: Applies business logic to distinguish apps from libraries

### 4. Classification Engine

**Purpose**: Determines if a package is a deployable Fusion app vs shared library

**Classification Algorithm**:

```mermaid
flowchart TD
    A["Package Analysis"] --> B{"Has @equinor/fusion-*<br/>dependencies?"}
    B -->|No| Z["❌ Not Fusion App"]
    B -->|Yes| C{"Has App Indicators?"}
    
    C --> C1["✅ Has CLI"]
    C --> C2["✅ Has App Scripts"]
    C --> C3["✅ Has App Config"]
    C --> C4["✅ Is Private"]
    
    C1 --> D{"Library Exclusions?"}
    C2 --> D
    C3 --> D
    C4 --> D
    
    C -->|None| Z
    
    D --> D1["📚 Has main/module/exports"]
    D --> D2["🌐 Is publishable (private: false)"]
    
    D1 --> E{"Publishable Library?"}
    D2 --> E
    
    E -->|Yes + No App Features| Z
    E -->|No| Y["✅ Fusion App"]
    D -->|No Exclusions| Y
```

**Classification Matrix**:

| Criteria | App | Library | Notes |
|----------|-----|---------|-------|
| Has `@equinor/fusion-*` deps | ✅ | ✅ | Required for both |
| Has `fusion-framework-cli` | ✅ | ❌ | Strong app indicator |
| Has build/start scripts | ✅ | ❌ | App-specific scripts |
| Has `fusion`/`fusionApp` config | ✅ | ❌ | Explicit app config |
| Has `main`/`module`/`exports` | ❌ | ✅ | Library structure |
| `private: false` + library structure | ❌ | ✅ | Publishable library |
| `private: true` | ✅ | ⚠️ | Usually app |

### 5. Change Detection Engine

**Purpose**: Maps changed files to affected applications

**Change Detection Flow**:
```mermaid
flowchart TD
    A["Changed Files"] --> B["For Each App"]
    B --> C{"File matches<br/>app path?"}
    C -->|"file.startsWith(app.path + '/')"| D["✅ App Changed"]
    C -->|"file === app.path"| D
    C -->|"file === '**/*'"| D
    C -->|No match| E["Continue to next"]
    E --> B
    D --> F["Add to changed apps"]
    F --> B
```

**Path Normalization**:
- Removes `./` prefix from file paths
- Ensures consistent path separator usage
- Handles edge cases like empty paths

### 6. Output Generation Engine

**Purpose**: Formats results for GitHub Actions consumption

**Output Types**:

| Output | Format | Purpose |
|--------|--------|---------|
| `changed-apps` | JSON Array | Complete app objects for complex logic |
| `changed-app-names` | String | Simple comma-separated list |
| `changed-app-paths` | JSON Array | Paths for file operations |
| `matrix` | GitHub Matrix | Parallel job execution |
| `has-changes` | Boolean String | Conditional workflow steps |
| `summary` | String | Human-readable status |

## Data Flow Architecture

### Primary Data Flow

```mermaid
flowchart TD
    subgraph "Input Processing"
        I1["📥 Inputs<br/>• app-paths<br/>• token"]
        I2["⚙️ Config<br/>• Normalized patterns"]
        I3["🎯 Patterns<br/>• Glob<br/>• Direct"]
        
        I1 --> I2
        I2 --> I3
    end
    
    subgraph "Git Analysis"
        G1["📍 Base Ref<br/>• PR base<br/>• HEAD~1"]
        G2["🔄 Diff<br/>• Strategy<br/>• Fallback"]
        G3["📁 Git Changes<br/>• File list<br/>• Normalized"]
        
        I3 --> G1
        G1 --> G2
        G2 --> G3
    end
    
    subgraph "App Discovery"
        D1["🔍 Directory Scanning"]
        D2["🏷️ Classification<br/>• Fusion deps<br/>• App logic"]
        D3["📋 App Registry<br/>• Name/Path<br/>• Validated"]
        
        I3 --> D1
        D1 --> D2
        D2 --> D3
    end
    
    subgraph "Change Detection"
        C1["🔗 Change Match<br/>• Path match<br/>• Filtering"]
        C2["📊 Results<br/>• Changed apps"]
        C3["📤 Outputs<br/>• JSON<br/>• Matrix"]
        
        G3 --> C1
        D3 --> C1
        C1 --> C2
        C2 --> C3
    end
```

### Error Handling Flow

```mermaid
flowchart LR
    subgraph "Error Sources"
        E1["⚠️ Git Failures"]
        E2["⚠️ Parse Failures"]
        E3["⚠️ IO Failures"]
    end
    
    subgraph "Error Handler"
        H["🛡️ Handler<br/>• Catch<br/>• Log<br/>• Warn<br/>• Context"]
    end
    
    subgraph "Recovery Actions"
        R1["🔄 Fallback"]
        R2["⏩ Continue"]
        R3["🛟 Fail Safe"]
        R4["📝 Report"]
    end
    
    E1 --> H
    E2 --> H
    E3 --> H
    
    H --> R1
    H --> R2
    H --> R3
    H --> R4
```

## Performance Considerations

### Optimization Strategies

```mermaid
mindmap
  root)Performance(
    Lazy Evaluation
      Only process package.json dirs
      Skip on classification failure
      Short-circuit app indicators
    File Operations
      fs.existsSync() checks
      Targeted directory scanning
      Cached package.json data
    Git Optimization
      --name-only flag
      Fallback strategies
      Limited stdio output
    Pattern Processing
      Parallel when possible
      Avoid recursive patterns
      Fail fast on invalid
```

### Scalability Limits

| Factor | Limit | Mitigation |
|--------|-------|------------|
| Repository size | ~10GB | Use specific patterns, not `**/*` |
| Number of apps | ~1000 | Efficient classification logic |
| File count | ~100k | Git name-only, targeted scanning |
| Pattern complexity | ~50 patterns | Validate and optimize patterns |

## Security Architecture

### Security Layers

```mermaid
graph LR
    subgraph "Input Security"
        A1["Path Validation"]
        A2["Pattern Limits"]
        A3["JSON Safety"]
    end
    
    subgraph "File System Security"
        B1["Path Sanitization"]
        B2["Read-Only Ops"]
        B3["Error Isolation"]
        B4["Resource Limits"]
    end
    
    subgraph "Git Security"
        C1["Command Templates"]
        C2["Output Limiting"]
        C3["Error Handling"]
        C4["No User Input"]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
    B4 --> C1
    C2 --> C3
    C3 --> C4
```

### Input Validation

```javascript
// Pattern validation
function validateAppPaths(appPaths) {
  // Prevent path traversal
  if (appPaths.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  // Limit pattern complexity
  if (appPaths.split(',').length > 50) {
    throw new Error('Too many patterns');
  }
}

// JSON parsing safety
function safeParseJson(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    core.warning(`Invalid JSON: ${error.message}`);
    return null;
  }
}
```

### File System Safety

- **Path Sanitization**: All paths validated and normalized
- **Read-Only Operations**: No file modifications or writes
- **Error Isolation**: File operation failures don't crash entire process
- **Resource Limits**: Bounded file reads and directory scanning

### Git Command Safety

- **Command Sanitization**: Git commands use safe, predefined templates
- **Output Limiting**: Git output restricted with stdio configuration
- **Error Handling**: All git failures handled gracefully
- **No User Input**: Git commands don't accept user-controlled parameters

## Extension Points

### Future Architecture

```mermaid
flowchart TD
    subgraph "Current Core"
        A["Classification Engine"]
        B["Output Generator"]
        C["Change Detector"]
    end
    
    subgraph "Extension Points"
        D["🔌 Plugin System"]
        E["🎨 Custom Classifiers"]
        F["📋 Output Formats"]
        G["🔗 Integration Hooks"]
    end
    
    A -.-> E
    B -.-> F
    C -.-> G
    
    D --> E
    D --> F
    D --> G
    
    subgraph "Future Integrations"
        H["Terraform Output"]
        I["Webhook Notifications"]
        J["Custom Validators"]
        K["App Type Detection"]
    end
    
    F -.-> H
    G -.-> I
    G -.-> J
    E -.-> K
```

### 1. Custom Classification Logic

```javascript
// Future: Plugin-based classification
function registerClassifier(name, classifierFn) {
  classifiers.set(name, classifierFn);
}

// Custom app type detection
function classifyAppType(packageJson, appPath) {
  if (hasNextJsConfig(appPath)) return 'nextjs-app';
  if (hasReactScripts(packageJson)) return 'react-app';
  if (hasFusionCli(packageJson)) return 'fusion-cli-app';
  return 'generic-app';
}
```

### 2. Enhanced Output Formats

```javascript
// Future: Configurable output formats
function setOutputs(changedApps, options = {}) {
  if (options.includeMetadata) {
    // Add file change details, timestamps, etc.
  }
  
  if (options.outputFormat === 'terraform') {
    // Generate Terraform-compatible output
  }
}
```

### 3. Integration Hooks

```javascript
// Future: Webhook/API integration
function notifyChanges(changedApps, webhookUrl) {
  // Send change notifications to external systems
}

function validateAppStructure(appPath) {
  // Custom validation logic
  // Integration with linting tools
}
```

## Testing Architecture

### Test Strategy

The codebase uses **Vitest** for testing with comprehensive coverage across all modules:

- **24 test cases** covering all public functions and edge cases
- **Modular testing**: Each core module (git, fusion-app, outputs) tested via main exports
- **Mocked dependencies**: Uses Vitest mocking for @actions/core, fs, and child_process
- **Type safety**: Full TypeScript testing with proper type checking

**Test Structure**:
```typescript
// src/index.test.ts - Single comprehensive test suite
describe("Fusion App Change Detection", () => {
  describe("getBaseRef", () => { /* 4 tests */ });
  describe("getChangedFiles", () => { /* 4 tests */ });
  describe("isFusionApp", () => { /* 6 tests */ });
  describe("findFusionApps", () => { /* 4 tests */ });
  describe("findChangedApps", () => { /* 4 tests */ });
  describe("setOutputs", () => { /* 2 tests */ });
});
```

```mermaid
flowchart TD
    subgraph "Unit Tests"
        U1["Classification Logic"]
        U2["Directory Scanning"] 
        U3["Git Operations"]
        U4["Output Generation"]
    end
    
    subgraph "Integration Tests"
        I1["End-to-End Workflow"]
        I2["Repository Fixtures"]
        I3["Error Scenarios"]
    end
    
    subgraph "Performance Tests"
        P1["Large Repositories"]
        P2["Complex Patterns"]
        P3["Memory Usage"]
    end
    
    U1 --> I1
    U2 --> I1
    U3 --> I1
    U4 --> I1
    
    I1 --> P1
    I2 --> P2
    I3 --> P3
```

### Test Data Strategy

- **Synthetic Repositories**: Controlled test environments
- **Real-World Examples**: Anonymized production patterns
- **Edge Cases**: Malformed files, complex structures
- **Performance Tests**: Large repository simulations

This architecture ensures the action is maintainable, extensible, and performant while providing reliable Fusion app detection across diverse repository structures.
