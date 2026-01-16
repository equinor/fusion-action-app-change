const core = require("@actions/core");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Determines if a dependency string represents a local package reference
 * @function isLocalDependency
 * @param {string} dependencyValue - The dependency version string
 * @returns {boolean} True if it's a local dependency
 */
function isLocalDependency(dependencyValue) {
  if (typeof dependencyValue !== 'string') return false;
  
  return (
    // Workspace dependencies
    dependencyValue.startsWith('workspace:') ||
    // File dependencies
    dependencyValue.startsWith('file:') ||
    // Relative path dependencies
    dependencyValue.startsWith('../') ||
    dependencyValue.startsWith('./') ||
    // Git dependencies with local paths
    dependencyValue.startsWith('git+file:') ||
    (dependencyValue.includes('localhost') || dependencyValue.includes('127.0.0.1'))
  );
}

/**
 * Extracts the package name from a local dependency reference
 * @function extractPackageNameFromLocalDep
 * @param {string} depName - Original dependency name
 * @param {string} depValue - Dependency version/path string
 * @param {string} packagePath - Path of the package that has this dependency
 * @returns {string|null} The actual package name, or null if not found
 */
function extractPackageNameFromLocalDep(depName, depValue, packagePath) {
  // For workspace: dependencies, the package name is the dependency name
  if (depValue.startsWith('workspace:')) {
    return depName;
  }
  
  // For file: dependencies, we need to resolve the path and read the package.json
  if (depValue.startsWith('file:')) {
    try {
      const relativePath = depValue.slice(5); // Remove 'file:'
      const fullPath = path.resolve(path.dirname(packagePath), relativePath);
      const targetPackageJsonPath = path.join(fullPath, 'package.json');
      
      if (fs.existsSync(targetPackageJsonPath)) {
        const targetPackageJson = JSON.parse(fs.readFileSync(targetPackageJsonPath, 'utf8'));
        return targetPackageJson.name || path.basename(fullPath);
      }
    } catch (error) {
      core.debug(`Could not resolve file dependency ${depValue}: ${error.message}`);
    }
  }
  
  // For relative path dependencies
  if (depValue.startsWith('../') || depValue.startsWith('./')) {
    try {
      const fullPath = path.resolve(path.dirname(packagePath), depValue);
      const targetPackageJsonPath = path.join(fullPath, 'package.json');
      
      if (fs.existsSync(targetPackageJsonPath)) {
        const targetPackageJson = JSON.parse(fs.readFileSync(targetPackageJsonPath, 'utf8'));
        return targetPackageJson.name || path.basename(fullPath);
      }
    } catch (error) {
      core.debug(`Could not resolve relative dependency ${depValue}: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Builds a dependency graph from apps and libraries to track local dependencies
 * @function buildDependencyGraph
 * @param {Object[]} packages - Array of apps and libraries
 * @returns {Map<string, Object>} Dependency graph with package info and dependencies
 */
function buildDependencyGraph(packages) {
  const graph = new Map();
  
  // First pass: Add all packages to graph
  for (const pkg of packages) {
    const packageJson = pkg.packageJson || JSON.parse(fs.readFileSync(path.join(pkg.path, "package.json"), "utf8"));
    
    graph.set(pkg.name, {
      name: pkg.name,
      path: pkg.path,
      packageJson: packageJson,
      dependencies: new Set(),
      dependents: new Set(),
      isApp: !Object.hasOwn(pkg, 'packageJson'), // apps don't have packageJson field set in findFusionApps
    });
  }
  
  // Second pass: Build dependency relationships
  for (const [packageName, packageInfo] of graph) {
    const allDeps = {
      ...packageInfo.packageJson.dependencies,
      ...packageInfo.packageJson.devDependencies,
    };
    
    // Find local dependencies (packages that exist in our graph)
    for (const [depName, depValue] of Object.entries(allDeps)) {
      // Check if it's a local dependency
      if (isLocalDependency(depValue)) {
        // Extract the actual package name
        const actualPackageName = extractPackageNameFromLocalDep(
          depName, 
          depValue, 
          path.join(packageInfo.path, 'package.json')
        );
        
        if (actualPackageName && graph.has(actualPackageName)) {
          packageInfo.dependencies.add(actualPackageName);
          graph.get(actualPackageName).dependents.add(packageName);
          core.debug(`📎 Found local dependency: ${packageName} -> ${actualPackageName} (${depValue})`);
        }
      } else if (graph.has(depName)) {
        // Regular local dependency (package name matches directly)
        packageInfo.dependencies.add(depName);
        graph.get(depName).dependents.add(packageName);
        core.debug(`📎 Found direct dependency: ${packageName} -> ${depName}`);
      }
    }
  }
  
  return graph;
}

/**
 * Finds all packages that transitively depend on the given packages
 * @function findTransitiveDependents
 * @param {string[]} changedPackages - Names of packages that changed
 * @param {Map<string, Object>} dependencyGraph - The dependency graph
 * @returns {Set<string>} Set of package names that depend on changed packages
 */
function findTransitiveDependents(changedPackages, dependencyGraph) {
  const affected = new Set();
  const toProcess = [...changedPackages];
  
  while (toProcess.length > 0) {
    const current = toProcess.pop();
    if (affected.has(current)) continue;
    
    affected.add(current);
    
    const packageInfo = dependencyGraph.get(current);
    if (packageInfo) {
      for (const dependent of packageInfo.dependents) {
        if (!affected.has(dependent)) {
          toProcess.push(dependent);
        }
      }
    }
  }
  
  // Remove the originally changed packages from the affected set
  // (we want to return only the dependents)
  for (const changed of changedPackages) {
    affected.delete(changed);
  }
  
  return affected;
}

module.exports = {
  isLocalDependency,
  extractPackageNameFromLocalDep,
  buildDependencyGraph,
  findTransitiveDependents,
};