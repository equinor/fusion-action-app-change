const core = require("@actions/core");

// Import our modular components
const { discoverAllPackages, findFusionApps, findFusionLibrariesFromWorkspace } = require("./lib/package-discovery");
const { hasFusionDependencies, isFusionApp } = require("./lib/package-classification");
const { buildDependencyGraph, findTransitiveDependents } = require("./lib/dependency-graph");
const { getBaseRef, getChangedFiles, findChangedApps, findChangedAppsWithDependencies } = require("./lib/change-detection");

/**
 * Helper function to set outputs reliably in both standalone and composite actions
 * @param {string} name - Output name
 * @param {string} value - Output value
 */
function setActionOutput(name, value) {
  // Use the standard @actions/core method - it handles GITHUB_OUTPUT correctly in v2+
  core.setOutput(name, value);

  // Add debugging output to help troubleshoot in GitHub Actions
  core.info(`📤 Set output ${name}=${value}`);
}

/**
 * Main function that orchestrates the Fusion app change detection process.
 *
 * This function:
 * 1. Parses input parameters (app-paths, enable-dependency-tracking)
 * 2. Determines the base reference for comparison
 * 3. Gets the list of changed files from git
 * 4. Discovers all Fusion apps and libraries in the workspace
 * 5. Builds dependency graph if dependency tracking is enabled
 * 6. Identifies which apps have direct changes or are affected by library changes
 * 7. Sets GitHub Actions outputs with the results
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
    const enableDependencyTracking = core.getInput("enable-dependency-tracking") === "true";
    const baseRef = getBaseRef();

    // Parse app patterns (for backward compatibility)
    let appPatterns = [];
    if (appPaths.startsWith("[") && appPaths.endsWith("]")) {
      appPatterns = JSON.parse(appPaths);
    } else {
      appPatterns = [appPaths];
    }

    // Get changed files
    const changedFiles = getChangedFiles(baseRef);

    let allApps = [];
    let allLibraries = [];
    let dependencyGraph = new Map();
    
    if (enableDependencyTracking) {
      // Use workspace discovery for better dependency tracking
      core.info("🔍 Dependency tracking enabled - scanning entire workspace");
      
      const allPackages = discoverAllPackages();
      
      // Separate apps from libraries
      allApps = allPackages.filter(pkg => isFusionApp(pkg.packageJson));
      allLibraries = allPackages.filter(pkg => 
        hasFusionDependencies(pkg.packageJson) && !isFusionApp(pkg.packageJson)
      );
      
      core.info(`🎯 Found ${allApps.length} Fusion apps`);
      core.info(`📚 Found ${allLibraries.length} Fusion libraries`);
      
      // Build dependency graph
      dependencyGraph = buildDependencyGraph([...allApps, ...allLibraries]);
      core.info(`🔗 Built dependency graph with ${dependencyGraph.size} packages`);
    } else {
      // Use pattern-based discovery (legacy mode)
      allApps = findFusionApps(appPatterns);
      core.info(`🎯 Found ${allApps.length} Fusion apps`);
    }

    // Determine changed apps (direct changes + library dependency changes)
    const changedApps = findChangedAppsWithDependencies(
      changedFiles, 
      allApps, 
      allLibraries, 
      dependencyGraph, 
      enableDependencyTracking
    );

    // Set outputs
    setOutputs(changedApps, changedFiles, allLibraries, enableDependencyTracking);

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
    setActionOutput("affected-by-dependencies", "[]");
    setActionOutput("changed-libraries", "[]");

    core.setFailed(`❌ ${errorMessage}`);
  }
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
 * - affected-by-dependencies: JSON array of apps affected by library changes
 * - changed-libraries: JSON array of changed libraries (when tracking enabled)
 *
 * @function setOutputs
 * @param {Object[]} changedApps - Array of changed Fusion apps
 * @param {string} changedApps[].name - App name
 * @param {string} changedApps[].path - App directory path
 * @param {string[]} [changedFiles=[]] - Array of changed file paths
 * @param {Object[]} [allLibraries=[]] - Array of all discovered libraries
 * @param {boolean} [enableDependencyTracking=false] - Whether dependency tracking is enabled
 */
function setOutputs(changedApps, changedFiles = [], allLibraries = [], enableDependencyTracking = false) {
  const appNames = changedApps.map((app) => app.name);
  const appPaths = changedApps.map((app) => app.path);
  const hasChanges = changedApps.length > 0;

  // Create matrix for GitHub Actions
  const matrix = {
    include: changedApps.map((app) => ({
      name: app.name,
      path: app.path,
      changeReason: app.changeReason || 'direct',
    })),
  };

  // Separate apps by change reason
  const directlyChangedApps = changedApps.filter(app => !app.changeReason || app.changeReason === 'direct');
  const dependencyAffectedApps = changedApps.filter(app => app.changeReason === 'dependency');
  
  // Find changed libraries if dependency tracking is enabled
  const changedLibraries = enableDependencyTracking ? 
    findChangedApps(changedFiles, allLibraries) : [];

  // Generate summary
  let summary = "";
  if (hasChanges) {
    const directCount = directlyChangedApps.length;
    const depCount = dependencyAffectedApps.length;
    const libCount = changedLibraries.length;
    
    const parts = [];
    if (directCount > 0) {
      parts.push(`${directCount} app${directCount === 1 ? '' : 's'} changed`);
    }
    if (depCount > 0) {
      parts.push(`${depCount} app${depCount === 1 ? '' : 's'} affected by dependencies`);
    }
    if (libCount > 0) {
      parts.push(`${libCount} librar${libCount === 1 ? 'y' : 'ies'} changed`);
    }
    
    summary = parts.join(', ');
    if (appNames.length > 0) {
      summary += `: ${appNames.join(", ")}`;
    }
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
  setActionOutput("affected-by-dependencies", JSON.stringify(dependencyAffectedApps));
  setActionOutput("changed-libraries", JSON.stringify(changedLibraries));

  // Also log the summary for debugging
  core.info(`📋 Summary: ${summary}`);
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
  findFusionLibrariesFromWorkspace,
  hasFusionDependencies,
  buildDependencyGraph,
  findTransitiveDependents,
  discoverAllPackages,
  isFusionApp,
  findChangedApps,
  findChangedAppsWithDependencies,
  setOutputs,
};