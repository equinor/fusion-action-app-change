import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import type { FusionApp, PackageJson } from "../types/index.js";

/**
 * Discovers Fusion applications in the workspace using configurable patterns.
 *
 * Supports multiple pattern formats:
 * - Glob patterns: "apps/*" (searches inside the apps directory)
 * - Direct paths: "apps" (searches the apps directory itself)
 * - Multiple patterns: ["apps/*", "packages/apps/*"]
 *
 * For each discovered directory, validates if it's a Fusion app by:
 * 1. Checking for package.json existence
 * 2. Parsing package.json content
 * 3. Applying Fusion app classification logic via isFusionApp()
 */
export function findFusionApps(patterns: string[]): FusionApp[] {
  const apps: FusionApp[] = [];

  for (const pattern of patterns) {
    try {
      // Handle different pattern formats
      let searchDirs: string[] = [];

      if (pattern.includes("*")) {
        // Glob pattern like "apps/*"
        const basePath = pattern.replace("/*", "");
        if (fs.existsSync(basePath) && fs.lstatSync(basePath).isDirectory()) {
          const entries = fs.readdirSync(basePath);
          searchDirs = entries
            .map((entry) => path.join(basePath, entry))
            .filter((dirPath) => {
              return fs.lstatSync(dirPath).isDirectory();
            });
        } else {
          core.warning(`⚠️ Base path does not exist or is not a directory: ${basePath}`);
        }
      } else {
        // Direct path
        if (fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()) {
          searchDirs = [pattern];
        } else {
          core.warning(`⚠️ Direct path does not exist: ${pattern}`);
        }
      }

      // Check each directory for Fusion apps
      for (const dir of searchDirs) {
        const packageJsonPath = path.join(dir, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson;
            const appName = packageJson.name || path.basename(dir);

            if (isFusionApp(packageJson)) {
              apps.push({
                name: appName,
                path: dir,
              });
            }
          } catch (parseError) {
            core.warning(
              `⚠️ Could not parse ${packageJsonPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            );
          }
        }
      }
    } catch (patternError) {
      core.warning(
        `⚠️ Pattern ${pattern} failed: ${patternError instanceof Error ? patternError.message : String(patternError)}`,
      );
    }
  }

  return apps;
}

/**
 * Determines if a package.json represents a Fusion application (vs library).
 *
 * Classification Algorithm:
 * 1. Must have @equinor/fusion-* dependencies (required baseline)
 * 2. Strong app indicators (any of these qualifies as app):
 *    - Has @equinor/fusion-framework-cli dependency
 *    - Has app-building scripts (build, start, etc.)
 *    - Has Fusion app configuration (fusion/fusionApp fields)
 *    - Is a private package (private: true)
 * 3. Library exclusions:
 *    - Publishable libraries (has main/module/exports + not private)
 *    - Packages without app scripts or config
 */
export function isFusionApp(packageJson: PackageJson): boolean {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Must have Fusion dependencies
  const fusionDeps = Object.keys(allDeps).filter((dep) => dep.startsWith("@equinor/fusion"));
  const hasFusionDeps = fusionDeps.length > 0;

  if (!hasFusionDeps) return false;

  // Strong indicators it's an app (not library)
  const hasCli = !!allDeps["@equinor/fusion-framework-cli"];

  const scripts = packageJson.scripts || {};
  const hasAppScripts = Object.keys(scripts).some(
    (script) =>
      script.includes("build") ||
      script.includes("start") ||
      (scripts[script] || "").includes("fusion-framework-cli") ||
      (scripts[script] || "").includes("ffc"),
  );

  const hasAppConfig = !!(packageJson.fusion || packageJson.fusionApp);

  // Exclude clear libraries
  const isLibrary = !!(packageJson.main || packageJson.module || packageJson.exports);
  const isPublishable = !packageJson.private && isLibrary;

  if (isPublishable && !hasAppScripts && !hasAppConfig) {
    return false;
  }

  return hasCli || hasAppScripts || hasAppConfig || !!packageJson.private;
}

/**
 * Identifies which discovered Fusion apps have changes based on the changed files list.
 *
 * Change detection logic:
 * - Normalizes file paths (removes leading './')
 * - Checks if any changed file is within an app's directory
 * - Handles special cases like universal wildcards (all files changed)
 */
export function findChangedApps(changedFiles: string[], allApps: FusionApp[]): FusionApp[] {
  const changedApps: FusionApp[] = [];

  for (const app of allApps) {
    const isChanged = changedFiles.some((file) => {
      const normalizedFile = file.startsWith("./") ? file.slice(2) : file;
      const normalizedAppPath = app.path.startsWith("./") ? app.path.slice(2) : app.path;

      // Special case: root-level app (path is ".")
      if (normalizedAppPath === ".") {
        return true; // All files belong to root-level app
      }

      return (
        normalizedFile.startsWith(`${normalizedAppPath}/`) ||
        normalizedFile === normalizedAppPath ||
        file === "**/*"
      ); // Fallback case
    });

    if (isChanged) {
      changedApps.push(app);
    }
  }

  return changedApps;
}
