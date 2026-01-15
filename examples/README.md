# Example Fusion App Structures

This directory contains examples of how Fusion apps should be structured for proper change detection.

## Single App Structure

```
my-fusion-app/
├── app-manifest.json    # Required - Contains app metadata
├── package.json         # Optional - Node.js dependencies
├── src/
│   ├── index.ts        # Main application entry point
│   ├── components/     # React components
│   └── styles/         # CSS/SCSS files
├── public/             # Static assets
└── dist/               # Build output (excluded from change detection)
```

## Multi-App Repository Structure

```
fusion-apps-repo/
├── apps/
│   ├── app-one/
│   │   ├── app-manifest.json
│   │   ├── package.json
│   │   └── src/
│   ├── app-two/
│   │   ├── app-manifest.json
│   │   ├── package.json
│   │   └── src/
│   └── shared/
│       └── components/     # Shared components (no app-manifest.json)
├── packages/
│   └── ui-library/         # Shared library (no app-manifest.json)
└── tools/                  # Build tools (excluded)
```

## Manifest File Requirements

The `app-manifest.json` file must contain at minimum:

```json
{
  "key": "unique-app-identifier",
  "name": "Human Readable App Name",
  "version": "1.0.0",
  "type": "standalone"
}
```

### Optional Fields

```json
{
  "key": "my-app",
  "name": "My App",
  "version": "1.2.3",
  "type": "standalone",
  "description": "App description",
  "category": "productivity",
  "tags": ["fusion", "app"],
  "builder": "vite",
  "resources": {
    "scripts": ["index.js"],
    "styles": ["styles.css"]
  }
}
```

## Change Detection Behavior

- The action will recursively search for `app-manifest.json` files
- Each directory containing a manifest is considered a Fusion app
- Changes are detected by comparing file modifications within app directories
- Files matching exclude patterns (node_modules, dist, etc.) are ignored
- Shared libraries without manifests won't trigger app-specific builds