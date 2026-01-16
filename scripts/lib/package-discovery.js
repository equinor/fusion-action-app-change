const core = require("@actions/core");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Discovers all packages in the workspace by recursively searching for package.json files
 * @function discoverAllPackages
 * @param {string} rootDir - Root directory to search from
 * @param {string[]} excludeDirs - Directories to exclude (like node_modules)
 * @returns {Object[]} Array of package objects with name, path, and packageJson
 */
function discoverAllPackages(rootDir = ".", excludeDirs = ["node_modules", ".git", "coverage", "dist", "build", ".next", ".vscode", ".github"]) {
  const packages = [];
  const foundPackages = new Set(); // Prevent duplicate packages
  
  function scanDirectory(currentDir, depth = 0) {
    // Prevent infinite recursion and overly deep searches
    if (depth > 8) return;
    
    try {
      const entries = fs.readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        
        // Skip if not a directory
        try {
          if (!fs.lstatSync(fullPath).isDirectory()) continue;
        } catch {
          // Skip if we can't stat the file (broken symlinks, etc.)
          continue;
        }
        
        // Skip excluded directories
        if (excludeDirs.includes(entry)) continue;
        
        // Skip hidden directories except for specific ones we might want
        if (entry.startsWith('.') && !entry.match(/^\.(config|vscode|github)$/)) continue;
        
        // Check if this directory has a package.json
        const packageJsonPath = path.join(fullPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            const packageName = packageJson.name || path.basename(fullPath);
            
            // Avoid duplicate packages (same name from different paths)
            const packageKey = `${packageName}:${fullPath}`;
            if (!foundPackages.has(packageKey)) {
              foundPackages.add(packageKey);
              packages.push({
                name: packageName,
                path: fullPath,
                packageJson: packageJson,
              });
              core.debug(`📦 Discovered package: ${packageName} at ${fullPath}`);
            }
          } catch (parseError) {
            core.warning(`⚠️ Could not parse ${packageJsonPath}: ${parseError.message}`);
          }
        }
        
        // Recursively scan subdirectories
        scanDirectory(fullPath, depth + 1);
      }
    } catch (error) {
      core.debug(`⚠️ Could not scan directory ${currentDir}: ${error.message}`);
    }
  }
  
  scanDirectory(rootDir);
  core.info(`🔍 Discovered ${packages.length} total packages in workspace`);
  return packages;
}

/**
 * Finds Fusion applications using configurable patterns (legacy support)
 * @function findFusionApps
 * @param {string[]} patterns - Array of path patterns to search for apps
 * @returns {Object[]} Array of app objects with name and path properties
 */
function findFusionApps(patterns) {
  const { isFusionApp } = require('./package-classification');
  const apps = [];

  for (const pattern of patterns) {
    try {
      let searchDirs = [];

      if (pattern.includes("*")) {
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
        if (fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()) {
          searchDirs = [pattern];
        } else {
          core.warning(`⚠️ Direct path does not exist: ${pattern}`);
        }
      }

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
 * Discovers Fusion libraries by finding all packages and filtering out apps
 * @function findFusionLibrariesFromWorkspace
 * @returns {Object[]} Array of library objects with name, path, and packageJson
 */
function findFusionLibrariesFromWorkspace() {
  const { hasFusionDependencies, isFusionApp } = require('./package-classification');
  
  const allPackages = discoverAllPackages();
  const libraries = [];

  for (const pkg of allPackages) {
    if (hasFusionDependencies(pkg.packageJson) && !isFusionApp(pkg.packageJson)) {
      libraries.push(pkg);
    }
  }

  return libraries;
}

module.exports = {
  discoverAllPackages,
  findFusionApps,
  findFusionLibrariesFromWorkspace,
};