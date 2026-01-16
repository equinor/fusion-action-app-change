// Mock modules before any imports
jest.mock("@actions/core");
jest.mock("node:fs", () => {
  const originalFs = jest.requireActual("fs");
  return {
    ...originalFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    lstatSync: jest.fn(),
    readdirSync: jest.fn(),
  };
});
jest.mock("node:child_process", () => ({
  execSync: jest.fn(),
}));

const mockCore = require("@actions/core");
const mockFs = require("node:fs");
const mockChildProcess = require("node:child_process");

describe("Dependency Tracking Features", () => {
  let indexModule;

  beforeAll(() => {
    // Import after mocking
    indexModule = require("./index");
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks to defaults
    mockCore.getInput.mockReturnValue("");
    mockCore.info.mockImplementation(() => {});
    mockCore.warning.mockImplementation(() => {});
    mockCore.setOutput.mockImplementation(() => {});
    mockCore.setFailed.mockImplementation(() => {});

    // Default filesystem mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.lstatSync.mockReturnValue({ isDirectory: () => true });
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.readFileSync.mockReturnValue('{"name": "test"}');

    // Default git command mock
    mockChildProcess.execSync.mockReturnValue("");

    // Reset environment
    process.env.GITHUB_EVENT_NAME = undefined;
    process.env.GITHUB_EVENT_PATH = undefined;
  });

  describe("hasFusionDependencies", () => {
    test("should return true for packages with fusion dependencies", () => {
      const packageJson = {
        dependencies: { "@equinor/fusion-framework": "^1.0.0" },
      };

      const result = indexModule.hasFusionDependencies(packageJson);

      expect(result).toBe(true);
    });

    test("should return true for packages with fusion devDependencies", () => {
      const packageJson = {
        devDependencies: { "@equinor/fusion-framework-cli": "^1.0.0" },
      };

      const result = indexModule.hasFusionDependencies(packageJson);

      expect(result).toBe(true);
    });

    test("should return true for packages with fusion peerDependencies", () => {
      const packageJson = {
        peerDependencies: { "@equinor/fusion-components": "^1.0.0" },
      };

      const result = indexModule.hasFusionDependencies(packageJson);

      expect(result).toBe(true);
    });

    test("should return false for packages without fusion dependencies", () => {
      const packageJson = {
        dependencies: { "react": "^18.0.0" },
      };

      const result = indexModule.hasFusionDependencies(packageJson);

      expect(result).toBe(false);
    });
  });

  describe("discoverAllPackages", () => {
    beforeEach(() => {
      mockFs.existsSync.mockImplementation((path) => {
        const validPaths = [
          ".", "apps", "packages", "nested", "nested/deep",
          "apps/app1/package.json", "packages/lib1/package.json", 
          "nested/deep/package.json", "node_modules/some-dep/package.json"
        ];
        return validPaths.includes(path);
      });
      
      mockFs.lstatSync.mockImplementation((path) => ({
        isDirectory: () => !path.endsWith('.json')
      }));
      
      mockFs.readdirSync.mockImplementation((path) => {
        if (path === ".") return ["apps", "packages", "nested", "node_modules"];
        if (path === "apps") return ["app1"];
        if (path === "packages") return ["lib1"];
        if (path === "nested") return ["deep"];
        if (path === "nested/deep") return [];
        if (path === "node_modules") return ["some-dep"];
        return [];
      });
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: "test-package" }));
    });

    test("should discover all packages in workspace", () => {
      const result = indexModule.discoverAllPackages();

      expect(result).toHaveLength(3); // Should find 3 packages (excluding node_modules)
      expect(result.find(pkg => pkg.path === "apps/app1")).toBeDefined();
      expect(result.find(pkg => pkg.path === "packages/lib1")).toBeDefined();
      expect(result.find(pkg => pkg.path === "nested/deep")).toBeDefined();
    });

    test("should exclude node_modules by default", () => {
      const result = indexModule.discoverAllPackages();

      expect(result.find(pkg => pkg.path.includes("node_modules"))).toBeUndefined();
    });

    test("should respect custom exclude dirs", () => {
      const result = indexModule.discoverAllPackages(".", ["packages"]);

      expect(result.find(pkg => pkg.path === "packages/lib1")).toBeUndefined();
      expect(result.find(pkg => pkg.path === "apps/app1")).toBeDefined();
    });
  });

  describe("findFusionLibrariesFromWorkspace", () => {
    beforeEach(() => {
      // Mock filesystem for workspace scanning
      mockFs.existsSync.mockImplementation((path) => {
        const validPaths = [
          ".", "apps", "packages", "some-lib", "another-dir",
          "apps/app1", "packages/lib1", "some-lib/package.json", 
          "apps/app1/package.json", "packages/lib1/package.json"
        ];
        return validPaths.includes(path);
      });
      
      mockFs.lstatSync.mockImplementation((path) => ({
        isDirectory: () => !path.endsWith('.json')
      }));
      
      mockFs.readdirSync.mockImplementation((path) => {
        if (path === ".") return ["apps", "packages", "some-lib", "another-dir", "node_modules"];
        if (path === "apps") return ["app1"];
        if (path === "packages") return ["lib1"];
        if (path === "another-dir") return [];
        return [];
      });
      
      mockFs.readFileSync.mockImplementation((path) => {
        if (path === "some-lib/package.json") {
          return JSON.stringify({
            name: "@company/some-lib",
            main: "dist/index.js",
            dependencies: { "@equinor/fusion-framework": "^1.0.0" },
          });
        }
        if (path === "apps/app1/package.json") {
          return JSON.stringify({
            name: "app1",
            private: true,
            dependencies: { "@equinor/fusion-framework": "^1.0.0" },
          });
        }
        if (path === "packages/lib1/package.json") {
          return JSON.stringify({
            name: "@company/lib1",
            main: "dist/index.js",
            dependencies: { "@equinor/fusion-components": "^1.0.0" },
          });
        }
        return "{}";
      });
    });

    test("should find fusion libraries anywhere in workspace", () => {
      const result = indexModule.findFusionLibrariesFromWorkspace();

      expect(result).toHaveLength(2);
      expect(result.find(lib => lib.name === "@company/some-lib")).toBeDefined();
      expect(result.find(lib => lib.name === "@company/lib1")).toBeDefined();
    });

    test("should not include apps in library results", () => {
      const result = indexModule.findFusionLibrariesFromWorkspace();

      expect(result.find(lib => lib.name === "app1")).toBeUndefined();
    });

    test("should exclude node_modules and other ignored directories", () => {
      // Mock a fusion package in node_modules
      mockFs.existsSync.mockImplementation((path) => {
        const validPaths = [
          ".", "node_modules", "node_modules/@equinor",
          "node_modules/@equinor/fusion-framework/package.json"
        ];
        return validPaths.includes(path);
      });
      
      mockFs.readdirSync.mockImplementation((path) => {
        if (path === ".") return ["node_modules"];
        if (path === "node_modules") return ["@equinor"];
        if (path === "node_modules/@equinor") return ["fusion-framework"];
        return [];
      });

      const result = indexModule.findFusionLibrariesFromWorkspace();

      expect(result).toHaveLength(0); // Should not find anything in node_modules
    });
  });

  describe("buildDependencyGraph", () => {
    test("should build dependency relationships", () => {
      const packages = [
        {
          name: "app1",
          path: "apps/app1",
        },
        {
          name: "@company/lib1",
          path: "packages/lib1",
          packageJson: {
            name: "@company/lib1",
            dependencies: {},
          },
        },
      ];

      // Mock reading package.json for app1
      mockFs.readFileSync.mockImplementation((path) => {
        if (path === "apps/app1/package.json") {
          return JSON.stringify({
            name: "app1",
            dependencies: { "@company/lib1": "^1.0.0" },
          });
        }
        return "{}";
      });

      const result = indexModule.buildDependencyGraph(packages);

      expect(result.size).toBe(2);
      expect(result.get("app1").dependencies.has("@company/lib1")).toBe(true);
      expect(result.get("@company/lib1").dependents.has("app1")).toBe(true);
    });

    test("should handle transitive dependencies", () => {
      const packages = [
        {
          name: "app1",
          path: "apps/app1",
        },
        {
          name: "@company/lib1",
          path: "packages/lib1",
          packageJson: {
            name: "@company/lib1",
            dependencies: { "@company/lib2": "^1.0.0" },
          },
        },
        {
          name: "@company/lib2",
          path: "packages/lib2",
          packageJson: {
            name: "@company/lib2",
            dependencies: {},
          },
        },
      ];

      // Mock reading package.json for app1
      mockFs.readFileSync.mockImplementation((path) => {
        if (path === "apps/app1/package.json") {
          return JSON.stringify({
            name: "app1",
            dependencies: { "@company/lib1": "^1.0.0" },
          });
        }
        return "{}";
      });

      const result = indexModule.buildDependencyGraph(packages);

      expect(result.size).toBe(3);
      expect(result.get("app1").dependencies.has("@company/lib1")).toBe(true);
      expect(result.get("@company/lib1").dependencies.has("@company/lib2")).toBe(true);
      expect(result.get("@company/lib2").dependents.has("@company/lib1")).toBe(true);
    });
    test("should handle workspace dependencies", () => {
      const packages = [
        {
          name: "app-portal",
          path: "apps/app-portal",
        },
        {
          name: "@equinor/fusion-portal-extensions-actions",
          path: "packages/portal-extensions/actions",
          packageJson: {
            name: "@equinor/fusion-portal-extensions-actions",
            dependencies: { "@equinor/fusion-components": "^1.0.0" },
          },
        },
      ];

      // Mock reading package.json for app-portal with workspace dependencies
      mockFs.readFileSync.mockImplementation((path) => {
        if (path === "apps/app-portal/package.json") {
          return JSON.stringify({
            name: "app-portal",
            dependencies: { 
              "@equinor/fusion-framework": "^1.0.0",
              "@equinor/fusion-portal-extensions-actions": "workspace:*"
            },
          });
        }
        return "{}";
      });

      const result = indexModule.buildDependencyGraph(packages);

      expect(result.size).toBe(2);
      expect(result.get("app-portal").dependencies.has("@equinor/fusion-portal-extensions-actions")).toBe(true);
      expect(result.get("@equinor/fusion-portal-extensions-actions").dependents.has("app-portal")).toBe(true);
    });
  });

  describe("findTransitiveDependents", () => {
    test("should find direct dependents", () => {
      const graph = new Map();
      
      graph.set("lib1", {
        name: "lib1",
        dependencies: new Set(),
        dependents: new Set(["app1"]),
      });
      
      graph.set("app1", {
        name: "app1",
        dependencies: new Set(["lib1"]),
        dependents: new Set(),
      });

      const result = indexModule.findTransitiveDependents(["lib1"], graph);

      expect(result.has("app1")).toBe(true);
      expect(result.has("lib1")).toBe(false); // Should not include the original changed package
    });

    test("should find transitive dependencies", () => {
      const graph = new Map();
      
      // lib1 -> app1, lib2 -> app2, lib1 -> lib2 (so lib1 transitively affects app2)
      graph.set("lib1", {
        name: "lib1",
        dependencies: new Set(),
        dependents: new Set(["app1", "lib2"]),
      });
      
      graph.set("lib2", {
        name: "lib2",
        dependencies: new Set(["lib1"]),
        dependents: new Set(["app2"]),
      });
      
      graph.set("app1", {
        name: "app1",
        dependencies: new Set(["lib1"]),
        dependents: new Set(),
      });
      
      graph.set("app2", {
        name: "app2",
        dependencies: new Set(["lib2"]),
        dependents: new Set(),
      });

      const result = indexModule.findTransitiveDependents(["lib1"], graph);

      expect(result.has("app1")).toBe(true);
      expect(result.has("lib2")).toBe(true);
      expect(result.has("app2")).toBe(true);
      expect(result.has("lib1")).toBe(false); // Should not include the original changed package
    });
  });

  describe("findChangedAppsWithDependencies", () => {
    test("should return directly changed apps when dependency tracking disabled", () => {
      const changedFiles = ["apps/app1/src/index.js"];
      const allApps = [{ name: "app1", path: "apps/app1" }];
      const allLibraries = [{ name: "lib1", path: "packages/lib1" }];
      const graph = new Map();
      
      const result = indexModule.findChangedAppsWithDependencies(
        changedFiles, allApps, allLibraries, graph, false
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("app1");
      expect(result[0].changeReason).toBeUndefined();
    });

    test("should include apps affected by library changes", () => {
      const changedFiles = ["packages/lib1/src/index.js"];
      const allApps = [
        { name: "app1", path: "apps/app1" },
        { name: "app2", path: "apps/app2" },
      ];
      const allLibraries = [{ name: "lib1", path: "packages/lib1" }];
      
      const graph = new Map();
      graph.set("lib1", {
        name: "lib1",
        dependencies: new Set(),
        dependents: new Set(["app1"]),
      });
      graph.set("app1", {
        name: "app1",
        dependencies: new Set(["lib1"]),
        dependents: new Set(),
        isApp: true,
      });
      graph.set("app2", {
        name: "app2",
        dependencies: new Set(),
        dependents: new Set(),
        isApp: true,
      });
      
      const result = indexModule.findChangedAppsWithDependencies(
        changedFiles, allApps, allLibraries, graph, true
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("app1");
      expect(result[0].changeReason).toBe("dependency");
    });

    test("should combine direct and dependency changes", () => {
      const changedFiles = ["apps/app1/src/index.js", "packages/lib1/src/index.js"];
      const allApps = [
        { name: "app1", path: "apps/app1" },
        { name: "app2", path: "apps/app2" },
      ];
      const allLibraries = [{ name: "lib1", path: "packages/lib1" }];
      
      const graph = new Map();
      graph.set("lib1", {
        name: "lib1",
        dependencies: new Set(),
        dependents: new Set(["app2"]),
      });
      graph.set("app1", {
        name: "app1",
        dependencies: new Set(),
        dependents: new Set(),
        isApp: true,
      });
      graph.set("app2", {
        name: "app2",
        dependencies: new Set(["lib1"]),
        dependents: new Set(),
        isApp: true,
      });
      
      const result = indexModule.findChangedAppsWithDependencies(
        changedFiles, allApps, allLibraries, graph, true
      );

      expect(result).toHaveLength(2);
      
      const directApp = result.find(app => app.name === "app1");
      const dependencyApp = result.find(app => app.name === "app2");
      
      expect(directApp.changeReason).toBeUndefined(); // Direct change
      expect(dependencyApp.changeReason).toBe("dependency"); // Library dependency change
    });
  });

  describe("integration test", () => {
    test("should detect apps affected by library changes through dependency tracking", async () => {
      // Set up mock for integration tests
      mockCore.getInput.mockImplementation((name) => {
        switch (name) {
          case "app-paths": return "apps/*";
          case "enable-dependency-tracking": return "true";
          default: return "";
        }
      });

      // Mock git diff to return library change
      mockChildProcess.execSync.mockReturnValue("packages/shared-lib/src/utils.js\n");

      // Mock filesystem structure for workspace discovery
      mockFs.existsSync.mockImplementation((path) => {
        const validPaths = [
          ".", "apps", "packages", 
          "apps/app1", "apps/app2", "packages/shared-lib",
          "apps/app1/package.json", "apps/app2/package.json", "packages/shared-lib/package.json"
        ];
        return validPaths.includes(path);
      });

      mockFs.lstatSync.mockImplementation((path) => ({
        isDirectory: () => !path.endsWith('.json')
      }));

      mockFs.readdirSync.mockImplementation((path) => {
        if (path === ".") return ["apps", "packages"];
        if (path === "apps") return ["app1", "app2"];
        if (path === "packages") return ["shared-lib"];
        return [];
      });

      mockFs.readFileSync.mockImplementation((path) => {
        if (path === "apps/app1/package.json") {
          return JSON.stringify({
            name: "app1",
            private: true,
            dependencies: { 
              "@equinor/fusion-framework": "^1.0.0",
              "@company/shared-lib": "^1.0.0"
            },
          });
        }
        if (path === "apps/app2/package.json") {
          return JSON.stringify({
            name: "app2",
            private: true,
            dependencies: { "@equinor/fusion-framework": "^1.0.0" },
          });
        }
        if (path === "packages/shared-lib/package.json") {
          return JSON.stringify({
            name: "@company/shared-lib",
            main: "dist/index.js",
            dependencies: { "@equinor/fusion-components": "^1.0.0" },
          });
        }
        return "{}";
      });

      await indexModule.run();

      // Verify outputs were set correctly
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps-count", "1");
      expect(mockCore.setOutput).toHaveBeenCalledWith("has-changes", "true");
      
      // Verify that app1 was detected as changed due to library dependency
      const changedAppsCall = mockCore.setOutput.mock.calls.find(call => call[0] === "changed-apps");
      expect(changedAppsCall).toBeDefined();
      
      const changedApps = JSON.parse(changedAppsCall[1]);
      expect(changedApps).toHaveLength(1);
      expect(changedApps[0].name).toBe("app1");
      expect(changedApps[0].changeReason).toBe("dependency");
    });
  });
});