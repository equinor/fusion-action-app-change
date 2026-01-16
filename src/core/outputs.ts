import * as core from "@actions/core";
import type { ActionsMatrix, FusionApp } from "../types/index.js";

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
export function setOutputs(changedApps: FusionApp[], changedFiles: string[] = []): void {
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

/**
 * Sets minimal outputs on error to prevent validation issues
 */
export function setErrorOutputs(errorMessage: string): void {
  setActionOutput("changed-apps", "[]");
  setActionOutput("changed-app-names", "");
  setActionOutput("changed-app-paths", "[]");
  setActionOutput("changed-files", "[]");
  setActionOutput("has-changes", "false");
  setActionOutput("summary", errorMessage);
  setActionOutput("app-types", "[]");
  setActionOutput("matrix", JSON.stringify({ include: [] }));
  setActionOutput("changed-apps-count", "0");
}
