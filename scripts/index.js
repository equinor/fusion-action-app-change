const core = require("@actions/core");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

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
 *
 * @async
 * @function run
 * @throws {Error} When detection fails due to git issues or parsing errors
 */
async function run() {
  try {
    core.info("🔍 Detecting changed Fusion apps...");

    // Get inputs with smart defaults
    const appPaths = core.getInput("app-paths") || "apps/*";
    const baseRef = getBaseRef();

    // Parse app patterns
    let appPatterns = [];
    if (appPaths.startsWith("[") && appPaths.endsWith("]")) {
      appPatterns = JSON.parse(appPaths);
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
    core.setFailed(
      `❌ Detection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Determines the appropriate git reference to use as the base for comparison.
 *
 * The base reference selection strategy:
 * - For pull requests: Uses the base branch SHA from the PR event
 * - For pushes: Uses the previous commit (HEAD~1)
 * - Falls back to 'main' branch if event parsing fails
 *
 * @function getBaseRef
 * @returns {string} The git reference to compare against (e.g., 'main', 'HEAD~1', or a specific SHA)
 */
function getBaseRef() {
  // Smart base ref detection based on event type
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === "pull_request") {
    try {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
      return event.pull_request?.base?.sha || "main";
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
 *
 * @function getChangedFiles
 * @param {string} baseRef - The git reference to compare against
 * @returns {string[]} Array of file paths that have changed
 */
function getChangedFiles(baseRef) {
  try {
    // Try different git diff approaches
    const commands = [
      `git diff --name-only ${baseRef}...HEAD`,
      `git diff --name-only ${baseRef} HEAD`,
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
    core.warning(`⚠️ Git diff failed: ${error.message}`);
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
 *
 * @function findFusionApps
 * @param {string[]} patterns - Array of path patterns to search for apps
 * @returns {Object[]} Array of app objects with name and path properties
 * @example
 * // Returns: [{ name: 'my-app', path: 'apps/my-app' }]
 * findFusionApps(['apps/*'])
 */
function findFusionApps(patterns) {
  const apps = [];

  for (const pattern of patterns) {
    try {
      // Handle different pattern formats
      let searchDirs = [];

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
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            const appName = packageJson.name || path.basename(dir);

            if (isFusionApp(packageJson)) {
              apps.push({
                name: appName,
                path: dir,
              });
            }
          } catch (parseError) {
            core.warning(`⚠️ Could not parse ${packageJsonPath}: ${parseError.message}`);
          }
        }
      }
    } catch (patternError) {
      core.warning(`⚠️ Pattern ${pattern} failed: ${patternError.message}`);
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
 *
 * @function isFusionApp
 * @param {Object} packageJson - Parsed package.json content
 * @param {Object} [packageJson.dependencies] - Runtime dependencies
 * @param {Object} [packageJson.devDependencies] - Development dependencies
 * @param {Object} [packageJson.scripts] - NPM scripts
 * @param {Object} [packageJson.fusion] - Fusion app configuration
 * @param {Object} [packageJson.fusionApp] - Alternative Fusion app config
 * @param {boolean} [packageJson.private] - Whether package is private
 * @param {string} [packageJson.main] - Main entry point (indicates library)
 * @param {string} [packageJson.module] - ES module entry (indicates library)
 * @param {Object} [packageJson.exports] - Export map (indicates library)
 * @returns {boolean} True if the package is classified as a Fusion app
 * @example
 * // App with CLI
 * isFusionApp({
 *   dependencies: { '@equinor/fusion-framework-cli': '^1.0.0' },
 *   scripts: { build: 'ffc build' }
 * }) // returns: true
 *
 * // Library (excluded)
 * isFusionApp({
 *   dependencies: { '@equinor/fusion-components': '^1.0.0' },
 *   main: 'dist/index.js',
 *   private: false
 * }) // returns: false
 */
function isFusionApp(packageJson) {
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

  return hasCli || hasAppScripts || hasAppConfig || packageJson.private;
}

/**
 * Identifies which discovered Fusion apps have changes based on the changed files list.
 *
 * Change detection logic:
 * - Normalizes file paths (removes leading './')
 * - Checks if any changed file is within an app's directory
 * - Handles special cases like universal wildcards (all files changed)
 *
 * @function findChangedApps
 * @param {string[]} changedFiles - Array of file paths that have changed
 * @param {Object[]} allApps - Array of all discovered Fusion apps
 * @param {string} allApps[].name - App name
 * @param {string} allApps[].path - App directory path
 * @returns {Object[]} Array of apps that have changes
 */
function findChangedApps(changedFiles, allApps) {
  const changedApps = [];

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
 *
 * @function setOutputs
 * @param {Object[]} changedApps - Array of changed Fusion apps
 * @param {string} changedApps[].name - App name
 * @param {string} changedApps[].path - App directory path
 * @param {string[]} [changedFiles=[]] - Array of changed file paths
 */
function setOutputs(changedApps, changedFiles = []) {
  const appNames = changedApps.map((app) => app.name);
  const appPaths = changedApps.map((app) => app.path);
  const hasChanges = changedApps.length > 0;

  // Create matrix for GitHub Actions
  const matrix = {
    include: changedApps.map((app) => ({
      name: app.name,
      path: app.path,
    })),
  };

  // Generate summary
  let summary;
  if (hasChanges) {
    summary = `${changedApps.length} Fusion app${changedApps.length === 1 ? "" : "s"} changed: ${appNames.join(", ")}`;
  } else {
    summary = "No Fusion apps changed";
  }

  // Set all outputs
  core.setOutput("changed-apps", JSON.stringify(changedApps));
  core.setOutput("changed-app-names", appNames.join(","));
  core.setOutput("changed-app-paths", JSON.stringify(appPaths));
  core.setOutput("changed-files", JSON.stringify(changedFiles));
  core.setOutput("has-changes", hasChanges.toString());
  core.setOutput("summary", summary);
  core.setOutput("app-types", JSON.stringify([])); // App types - will enhance later if needed
  core.setOutput("matrix", JSON.stringify(matrix));
  core.setOutput("changed-apps-count", changedApps.length.toString());
}

// Run the action
if (require.main === module) {
  run();
}

module.exports = {
  run,
  // Export internal functions for testing
  getBaseRef,
  getChangedFiles,
  findFusionApps,
  isFusionApp,
  findChangedApps,
  setOutputs,
};
