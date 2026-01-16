const core = require("@actions/core");
const { execSync } = require("node:child_process");
const { quote } = require("shell-quote");

/**
 * Determines the appropriate git reference to use as the base for comparison.
 * @function getBaseRef
 * @returns {string} The git reference to compare against (e.g., 'main', 'HEAD~1', or a specific SHA)
 */
function getBaseRef() {
  const fs = require("node:fs");
  
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
 * @function getChangedFiles
 * @param {string} baseRef - The git reference to compare against
 * @returns {string[]} Array of file paths that have changed
 */
function getChangedFiles(baseRef) {
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
    core.warning(`⚠️ Git diff failed: ${error.message}`);
    return ["**/*"];
  }
}

/**
 * Identifies which discovered Fusion apps have changes based on the changed files list.
 * @function findChangedApps
 * @param {string[]} changedFiles - Array of file paths that have changed
 * @param {Object[]} allApps - Array of all discovered Fusion apps
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
 * Enhanced version that finds changed apps including those affected by library dependencies
 * @function findChangedAppsWithDependencies
 * @param {string[]} changedFiles - Array of file paths that have changed
 * @param {Object[]} allApps - Array of all discovered Fusion apps
 * @param {Object[]} allLibraries - Array of all discovered Fusion libraries
 * @param {Map<string, Object>} dependencyGraph - Dependency graph
 * @param {boolean} enableDependencyTracking - Whether to track dependencies
 * @returns {Object[]} Array of apps that have changes or are affected by dependency changes
 */
function findChangedAppsWithDependencies(changedFiles, allApps, allLibraries, dependencyGraph, enableDependencyTracking) {
  const { findTransitiveDependents } = require('./dependency-graph');
  
  // Find directly changed apps
  const directlyChangedApps = findChangedApps(changedFiles, allApps);
  
  if (!enableDependencyTracking || allLibraries.length === 0) {
    return directlyChangedApps;
  }
  
  // Find changed libraries
  const changedLibraries = findChangedApps(changedFiles, allLibraries);
  const changedLibraryNames = changedLibraries.map(lib => lib.name);
  
  if (changedLibraryNames.length === 0) {
    return directlyChangedApps;
  }
  
  core.info(`📚 ${changedLibraryNames.length} libraries changed: ${changedLibraryNames.join(", ")}`);
  
  // Find apps affected by library changes
  const affectedPackageNames = findTransitiveDependents(changedLibraryNames, dependencyGraph);
  
  // Filter to only apps (not other libraries)
  const affectedApps = allApps.filter(app => affectedPackageNames.has(app.name));
  
  if (affectedApps.length > 0) {
    core.info(`🔗 ${affectedApps.length} apps affected by library changes: ${affectedApps.map(app => app.name).join(", ")}`);
  }
  
  // Combine and deduplicate
  const allChangedApps = [...directlyChangedApps];
  for (const affectedApp of affectedApps) {
    if (!allChangedApps.find(app => app.name === affectedApp.name)) {
      allChangedApps.push({
        ...affectedApp,
        changeReason: 'dependency'
      });
    }
  }
  
  return allChangedApps;
}

module.exports = {
  getBaseRef,
  getChangedFiles,
  findChangedApps,
  findChangedAppsWithDependencies,
};