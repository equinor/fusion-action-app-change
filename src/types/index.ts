/**
 * Type definitions for the Fusion Action App Change detection
 */

/**
 * Represents a Fusion application with its metadata
 */
export interface FusionApp {
  name: string;
  path: string;
}

/**
 * Package.json structure for type safety
 */
export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  fusion?: Record<string, unknown>;
  fusionApp?: Record<string, unknown>;
  private?: boolean;
  main?: string;
  module?: string;
  exports?: Record<string, unknown>;
}

/**
 * Result of resolving a git diff strategy.
 */
export interface GitComparison {
  baseRef: string;
  changedFiles: string[];
}

/**
 * Identifies one dependency entry in a pnpm workspace catalog.
 */
export interface CatalogEntry {
  catalog: string;
  dependency: string;
}

/**
 * GitHub Actions matrix structure
 */
export interface ActionsMatrix {
  include: Array<{
    name: string;
    path: string;
  }>;
}

/**
 * GitHub event pull request structure
 */
export interface GitHubEventPullRequest {
  pull_request?: {
    base?: {
      sha?: string;
    };
  };
}
