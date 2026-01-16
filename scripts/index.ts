import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import { quote } from "shell-quote";

/**
 * Represents a Fusion application with its metadata
 */
interface FusionApp {
  name: string;
  path: string;
}

/**
 * Package.json structure for type safety
 */
interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  fusion?: Record<string, unknown>;
  fusionApp?: Record<string, unknown>;
  private?: boolean;
  main?: string;
  module?: string;
  exports?: Record<string, unknown>;
}

/**
 * GitHub Actions matrix structure
 */
interface ActionsMatrix {
  include: Array<{
    name: string;
    path: string;
  }>;
}

/**
 * GitHub event pull request structure
 */
interface GitHubEventPullRequest {
  pull_request?: {
    base?: {
      sha?: string;
    };
  };
}

/**
 * Helper function to set outputs reliably in both standalone and composite actions
 */
function setActionOutput(name: string, value: string): void {
  // Use the standard @actions/core method - it handles GITHUB_OUTPUT correctly in v2+
  core.setOutput(name, value);

  // Add debugging output to help troubleshoot in GitHub Actions
  core.info(`📤 Set output ${name}=${value}`);
}

/**
 * Main function that orchestrates the Fusion app change detection process.
 *
 * This function:
 * 1. Parses input parameters (app-paths)
 * 2. Determines the base reference for comparison
 * 3. Gets the list of changed files from git
 * 4. Discovers all Fusion apps in the workspace
 * 5. Identifies which apps have changes
 * 6. Sets GitHub Actions outputs with the results
 */
async function run(): Promise<void> {
  try {
    core.info("🔍 Detecting changed Fusion apps...");

    // Get inputs with smart defaults
    const appPaths = core.getInput("app-paths") || "apps/*";
    const baseRef = getBaseRef();

    // Parse app patterns
    let appPatterns: string[] = [];
    if (appPaths.startsWith("[") && appPaths.endsWith("]")) {
      appPatterns = JSON.parse(appPaths) as string[];
    } else {
      appPatterns = [appPaths];
    }

    // Get changed files
    const changedFiles = getChangedFiles(baseRef);

    // Find all Fusion apps
    const allApps = findFusionApps(appPatterns);
    core.info(`🎯 Found ${allApps.length} Fusion apps`);

    // Determine changed apps
    const changedApps = findChangedApps(changedFiles, allApps);

    // Set outputs
    setOutputs(changedApps, changedFiles);

    // Log results
    if (changedApps.length > 0) {
      core.info(
        `📦 ${changedApps.length} apps changed: ${changedApps.map((app) => app.name).join(", ")}`,
      );
    } else {
      core.info("✨ No Fusion apps changed");
    }

    core.info("✅ Detection completed");
  } catch (error) {
    // Set minimal outputs even on failure to prevent validation errors
    const errorMessage = `Detection failed: ${error instanceof Error ? error.message : String(error)}`;

    setActionOutput("changed-apps", "[]");
    setActionOutput("changed-app-names", "");
    setActionOutput("changed-app-paths", "[]");
    setActionOutput("changed-files", "[]");
    setActionOutput("has-changes", "false");
    setActionOutput("summary", errorMessage);
    setActionOutput("app-types", "[]");
    setActionOutput("matrix", JSON.stringify({ include: [] }));
    setActionOutput("changed-apps-count", "0");

    core.setFailed(`❌ ${errorMessage}`);
  }
}

/**
 * Determines the appropriate git reference to use as the base for comparison.
 *
 * The base reference selection strategy:
 * - For pull requests: Uses the base branch SHA from the PR event
 * - For pushes: Uses the previous commit (HEAD~1)
 * - Falls back to 'main' branch if event parsing fails
 */
function getBaseRef(): string {
  // Smart base ref detection based on event type
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === "pull_request") {
    try {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath) {
        const event = JSON.parse(fs.readFileSync(eventPath, "utf8")) as GitHubEventPullRequest;
        return event.pull_request?.base?.sha || "main";
      }
      // No event path available, fallback to main
      return "main";
    } catch {
      return "main";
    }
  }

  return "HEAD~1";
}

/**
 * Retrieves the list of files that have changed between the base reference and HEAD.
 *
 * Uses multiple git diff strategies to ensure robust file detection:
 * 1. git diff --name-only baseRef...HEAD (preferred for PRs)
 * 2. git diff --name-only baseRef HEAD (fallback)
 * 3. git diff --name-only HEAD~1 HEAD (last resort)
 */
function getChangedFiles(baseRef: string): string[] {
  try {
    // Sanitize baseRef to prevent command injection
    const safeBaseRef = quote([baseRef]);

    // Try different git diff approaches
    const commands = [
      `git diff --name-only ${safeBaseRef}...HEAD`,
      `git diff --name-only ${safeBaseRef} HEAD`,
      "git diff --name-only HEAD~1 HEAD",
    ];

    for (const cmd of commands) {
      try {
        const output = execSync(cmd, {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        });
        const files = output.split("\n").filter((file) => file.trim());
        if (files.length > 0) {
          return files;
        }
      } catch {
        // continue to next command
      }
    }

    core.warning("⚠️ Could not determine changed files, assuming all apps may be affected");
    return ["**/*"];
  } catch (error) {
    core.warning(`⚠️ Git diff failed: ${error instanceof Error ? error.message : String(error)}`);
    return ["**/*"];
  }
}

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
function findFusionApps(patterns: string[]): FusionApp[] {
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
function isFusionApp(packageJson: PackageJson): boolean {
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
function findChangedApps(changedFiles: string[], allApps: FusionApp[]): FusionApp[] {
  const changedApps: FusionApp[] = [];

  for (const app of allApps) {
    const isChanged = changedFiles.some((file) => {
      const normalizedFile = file.startsWith("./") ? file.slice(2) : file;
      const normalizedAppPath = app.path.startsWith("./") ? app.path.slice(2) : app.path;

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

/**
 * Sets all GitHub Actions outputs with the detection results.
 *
 * Outputs provided:
 * - changed-apps: Full JSON array of changed app objects
 * - changed-app-names: Comma-separated list of app names
 * - changed-app-paths: JSON array of app directory paths
 * - changed-files: JSON array of all changed files
 * - has-changes: Boolean string indicating if any changes exist
 * - summary: Human-readable summary of changes
 * - app-types: JSON array of app types (placeholder for future enhancement)
 * - matrix: GitHub Actions matrix format for parallel jobs
 * - changed-apps-count: Number of changed apps as string
 */
function setOutputs(changedApps: FusionApp[], changedFiles: string[] = []): void {
  const appNames = changedApps.map((app) => app.name);
  const appPaths = changedApps.map((app) => app.path);
  const hasChanges = changedApps.length > 0;

  // Create matrix for GitHub Actions
  const matrix: ActionsMatrix = {
    include: changedApps.map((app) => ({
      name: app.name,
      path: app.path,
    })),
  };

  // Generate summary
  let summary = "";
  if (hasChanges) {
    summary = `${changedApps.length} Fusion app${changedApps.length === 1 ? "" : "s"} changed: ${appNames.join(", ")}`;
  } else {
    summary = "No Fusion apps changed";
  }

  // Set all outputs using reliable method for composite actions
  setActionOutput("changed-apps", JSON.stringify(changedApps));
  setActionOutput("changed-app-names", appNames.join(","));
  setActionOutput("changed-app-paths", JSON.stringify(appPaths));
  setActionOutput("changed-files", JSON.stringify(changedFiles));
  setActionOutput("has-changes", hasChanges.toString());
  setActionOutput("summary", summary);
  setActionOutput("app-types", JSON.stringify([])); // App types - will enhance later if needed
  setActionOutput("matrix", JSON.stringify(matrix));
  setActionOutput("changed-apps-count", changedApps.length.toString());

  // Also log the summary for debugging
  core.info(`📋 Summary: ${summary}`);
}

// Run the action
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    core.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  });
}

export {
  run,
  // Export internal functions for testing
  getBaseRef,
  getChangedFiles,
  findFusionApps,
  isFusionApp,
  findChangedApps,
  setOutputs,
};
