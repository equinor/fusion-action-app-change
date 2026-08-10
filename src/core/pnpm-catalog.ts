import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import { parse } from "yaml";
import type { CatalogEntry, FusionApp, PackageJson } from "../types/index.js";
import { getFileAtRef } from "./git.js";

const WORKSPACE_FILE = "pnpm-workspace.yaml";
const DEFAULT_CATALOG = "default";
const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

type CatalogValues = Map<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const catalogEntryKey = (catalog: string, dependency: string): string => {
  return `${catalog}\0${dependency}`;
};

const addCatalog = (values: CatalogValues, catalog: string, dependencies: unknown): void => {
  if (!isRecord(dependencies)) {
    throw new Error(`Catalog "${catalog}" must be a dependency map`);
  }

  for (const [dependency, version] of Object.entries(dependencies)) {
    if (typeof version !== "string") {
      throw new Error(`Catalog entry "${catalog}:${dependency}" must be a string`);
    }
    values.set(catalogEntryKey(catalog, dependency), version);
  }
};

const parseWorkspaceCatalogs = (content: string | undefined): CatalogValues => {
  if (content === undefined) {
    return new Map();
  }

  const workspace = parse(content) as unknown;
  if (workspace === null) {
    return new Map();
  }
  if (!isRecord(workspace)) {
    throw new Error("pnpm-workspace.yaml must contain a YAML object");
  }

  const values: CatalogValues = new Map();
  if (workspace.catalog !== undefined) {
    addCatalog(values, DEFAULT_CATALOG, workspace.catalog);
  }

  if (workspace.catalogs !== undefined) {
    if (!isRecord(workspace.catalogs)) {
      throw new Error('Workspace field "catalogs" must be a catalog map');
    }

    for (const [catalog, dependencies] of Object.entries(workspace.catalogs)) {
      if (catalog === DEFAULT_CATALOG && workspace.catalog !== undefined) {
        throw new Error('The default catalog cannot be defined in both "catalog" and "catalogs"');
      }
      addCatalog(values, catalog, dependencies);
    }
  }

  return values;
};

/**
 * Compares two pnpm workspace definitions and returns catalog entries whose
 * versions were added, removed, or changed.
 */
export const getChangedCatalogEntries = (
  baseWorkspace: string | undefined,
  headWorkspace: string | undefined,
): CatalogEntry[] => {
  const baseCatalogs = parseWorkspaceCatalogs(baseWorkspace);
  const headCatalogs = parseWorkspaceCatalogs(headWorkspace);
  const keys = new Set([...baseCatalogs.keys(), ...headCatalogs.keys()]);
  const changedEntries: CatalogEntry[] = [];

  for (const key of keys) {
    if (baseCatalogs.get(key) === headCatalogs.get(key)) {
      continue;
    }

    const [catalog, dependency] = key.split("\0");
    changedEntries.push({ catalog, dependency });
  }

  return changedEntries;
};

const getCatalogReference = (version: string): string | undefined => {
  if (!version.startsWith("catalog:")) {
    return undefined;
  }

  const catalog = version.slice("catalog:".length);
  return catalog === "" ? DEFAULT_CATALOG : catalog;
};

/**
 * Finds discovered apps whose package.json references one of the changed
 * catalog entries through pnpm's catalog protocol.
 */
export const findAppsConsumingCatalogEntries = (
  changedEntries: CatalogEntry[],
  allApps: FusionApp[],
): FusionApp[] => {
  if (changedEntries.length === 0) {
    return [];
  }

  const changedKeys = new Set(
    changedEntries.map(({ catalog, dependency }) => catalogEntryKey(catalog, dependency)),
  );

  return allApps.filter((app) => {
    const packageJsonPath = path.join(app.path, "package.json");

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson;

      return DEPENDENCY_SECTIONS.some((section) =>
        Object.entries(packageJson[section] ?? {}).some(([dependency, version]) => {
          const catalog = getCatalogReference(version);
          return catalog !== undefined && changedKeys.has(catalogEntryKey(catalog, dependency));
        }),
      );
    } catch (error) {
      core.warning(
        `⚠️ Could not inspect ${packageJsonPath} for catalog references: ${
          error instanceof Error ? error.message : String(error)
        }. Marking ${app.name} as changed.`,
      );
      return true;
    }
  });
};

/**
 * Maps a changed root pnpm workspace file to affected apps by comparing its
 * catalog definitions at the effective git base and HEAD.
 *
 * If the workspace definitions cannot be compared safely, all discovered apps
 * are returned to avoid missing a required deployment.
 */
export const findCatalogChangedApps = (
  changedFiles: string[],
  allApps: FusionApp[],
  baseRef: string,
): FusionApp[] => {
  const workspaceChanged = changedFiles.some(
    (file) => (file.startsWith("./") ? file.slice(2) : file) === WORKSPACE_FILE,
  );
  if (!workspaceChanged) {
    return [];
  }

  try {
    const changedEntries = getChangedCatalogEntries(
      getFileAtRef(baseRef, WORKSPACE_FILE),
      getFileAtRef("HEAD", WORKSPACE_FILE),
    );
    const changedApps = findAppsConsumingCatalogEntries(changedEntries, allApps);
    const appLabel = changedApps.length === 1 ? "app" : "apps";
    const entryLabel = changedEntries.length === 1 ? "entry" : "entries";

    core.debug(
      `pnpm catalog changes affected ${changedApps.length} ${appLabel} across ${changedEntries.length} changed catalog ${entryLabel}`,
    );
    return changedApps;
  } catch (error) {
    core.warning(
      `⚠️ Could not compare pnpm workspace catalogs: ${
        error instanceof Error ? error.message : String(error)
      }. Marking all discovered apps as changed.`,
    );
    return allApps;
  }
};
