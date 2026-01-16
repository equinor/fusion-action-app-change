const core = require("@actions/core");

/**
 * Checks if a package has Fusion-related dependencies
 * @function hasFusionDependencies
 * @param {Object} packageJson - Parsed package.json content
 * @returns {boolean} True if has @equinor/fusion-* dependencies
 */
function hasFusionDependencies(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };
  
  return Object.keys(allDeps).some(dep => dep.startsWith("@equinor/fusion"));
}

/**
 * Determines if a package.json represents a Fusion application (vs library).
 * @function isFusionApp
 * @param {Object} packageJson - Parsed package.json content
 * @returns {boolean} True if the package is classified as a Fusion app
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

module.exports = {
  hasFusionDependencies,
  isFusionApp,
};