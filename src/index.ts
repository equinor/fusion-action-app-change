import * as core from "@actions/core";
import { findChangedApps, findFusionApps } from "./core/fusion-app.js";
import { getBaseRef, getChangedFiles } from "./core/git.js";
import { setErrorOutputs, setOutputs } from "./core/outputs.js";

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

    const baseRef = getBaseRef();

    // Parse app patterns
    const appPathsInput = core.getInput("app-paths");
    let appPatterns: string[] = [];

    if (!appPathsInput || appPathsInput.trim() === "") {
      appPatterns = ["."];
    } else {
      appPatterns = appPathsInput.split(",").map((p) => p.trim());
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

    setErrorOutputs(errorMessage);
    core.setFailed(`❌ ${errorMessage}`);
  }
}

// Run the action
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    core.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  });
}

export { run };

export { findChangedApps, findFusionApps, isFusionApp } from "./core/fusion-app.js";
// Re-export all functions for testing
export { getBaseRef, getChangedFiles } from "./core/git.js";
export { setOutputs } from "./core/outputs.js";

// Re-export types
export type {
  ActionsMatrix,
  FusionApp,
  GitHubEventPullRequest,
  PackageJson,
} from "./types/index.js";
