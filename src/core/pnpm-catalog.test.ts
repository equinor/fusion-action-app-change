import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@actions/core");
vi.mock("node:fs");
vi.mock("./git.js", () => ({
  getFileAtRef: vi.fn(),
}));

import * as fs from "node:fs";
import * as core from "@actions/core";
import type { FusionApp, PackageJson } from "../types/index.js";
import { getFileAtRef } from "./git.js";
import {
  findAppsConsumingCatalogEntries,
  findCatalogChangedApps,
  getChangedCatalogEntries,
} from "./pnpm-catalog.js";

const apps: FusionApp[] = [
  { name: "app-one", path: "apps/one" },
  { name: "app-two", path: "apps/two" },
  { name: "app-three", path: "apps/three" },
  { name: "app-four", path: "apps/four" },
];

const mockPackageJson = (packages: Record<string, PackageJson>): void => {
  vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
    const packageJson = packages[String(filePath)];
    if (!packageJson) {
      throw new Error(`Unexpected package path: ${String(filePath)}`);
    }
    return JSON.stringify(packageJson);
  });
};

describe("pnpm catalog change detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("maps a changed default entry to all catalog: and catalog:default consumers", () => {
    const changedEntries = getChangedCatalogEntries(
      "catalog:\n  react: ^18.0.0\n",
      "catalog:\n  react: ^19.0.0\n",
    );
    mockPackageJson({
      "apps/one/package.json": { dependencies: { react: "catalog:" } },
      "apps/two/package.json": { devDependencies: { react: "catalog:default" } },
      "apps/three/package.json": { optionalDependencies: { react: "^19.0.0" } },
      "apps/four/package.json": { peerDependencies: { redux: "catalog:" } },
    });

    expect(findAppsConsumingCatalogEntries(changedEntries, apps)).toEqual([apps[0], apps[1]]);
  });

  test("does not mark an app consuming an unrelated default catalog entry", () => {
    const changedEntries = getChangedCatalogEntries(
      "catalog:\n  react: ^18.0.0\n  redux: ^4.0.0\n",
      "catalog:\n  react: ^19.0.0\n  redux: ^4.0.0\n",
    );
    mockPackageJson({
      "apps/one/package.json": { dependencies: { redux: "catalog:" } },
      "apps/two/package.json": { dependencies: { react: "^19.0.0" } },
      "apps/three/package.json": {},
      "apps/four/package.json": {},
    });

    expect(findAppsConsumingCatalogEntries(changedEntries, apps)).toEqual([]);
  });

  test("maps named catalog changes through every dependency section", () => {
    const changedEntries = getChangedCatalogEntries(
      "catalogs:\n  react18:\n    react: ^18.0.0\n",
      "catalogs:\n  react18:\n    react: ^18.3.0\n",
    );
    mockPackageJson({
      "apps/one/package.json": { dependencies: { react: "catalog:react18" } },
      "apps/two/package.json": { devDependencies: { react: "catalog:react18" } },
      "apps/three/package.json": { optionalDependencies: { react: "catalog:react18" } },
      "apps/four/package.json": { peerDependencies: { react: "catalog:react18" } },
    });

    expect(findAppsConsumingCatalogEntries(changedEntries, apps)).toEqual(apps);
  });

  test("detects catalog entry additions and removals", () => {
    expect(
      getChangedCatalogEntries(
        "catalog:\n  removed: ^1.0.0\n  stable: ^1.0.0\n",
        "catalog:\n  added: ^2.0.0\n  stable: ^1.0.0\n",
      ),
    ).toEqual([
      { catalog: "default", dependency: "removed" },
      { catalog: "default", dependency: "added" },
    ]);
  });

  test("does not inspect catalogs when the workspace file did not change", () => {
    expect(findCatalogChangedApps(["apps/one/src/index.ts"], apps, "main")).toEqual([]);
    expect(getFileAtRef).not.toHaveBeenCalled();
  });

  test("uses readable singular labels in catalog change debug output", () => {
    vi.mocked(getFileAtRef)
      .mockReturnValueOnce("catalog:\n  react: ^18.0.0\n")
      .mockReturnValueOnce("catalog:\n  react: ^19.0.0\n");
    mockPackageJson({
      "apps/one/package.json": { dependencies: { react: "catalog:" } },
    });

    expect(findCatalogChangedApps(["pnpm-workspace.yaml"], [apps[0]], "main")).toEqual([apps[0]]);
    expect(core.debug).toHaveBeenCalledWith(
      "pnpm catalog changes affected 1 app across 1 changed catalog entry",
    );
  });

  test("marks all apps when workspace catalog parsing is unsafe", () => {
    vi.mocked(getFileAtRef)
      .mockReturnValueOnce("catalog: [")
      .mockReturnValueOnce("catalog:\n  react: ^19.0.0\n");

    expect(findCatalogChangedApps(["pnpm-workspace.yaml"], apps, "main")).toEqual(apps);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Marking all discovered apps as changed"),
    );
  });

  test("marks only an app whose package.json cannot be inspected", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("permission denied");
    });

    expect(
      findAppsConsumingCatalogEntries([{ catalog: "default", dependency: "react" }], [apps[0]]),
    ).toEqual([apps[0]]);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Marking app-one as changed"),
    );
  });
});
