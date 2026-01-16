import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock modules before any imports
vi.mock("@actions/core");
vi.mock("node:fs");
vi.mock("node:child_process");

import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as core from "@actions/core";
import {
  findChangedApps,
  findFusionApps,
  getBaseRef,
  getChangedFiles,
  isFusionApp,
  setOutputs,
} from "./index";

describe("Fusion App Change Detection - Simple Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_EVENT_PATH;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getBaseRef", () => {
    test("returns HEAD~1 for non-PR events", () => {
      process.env.GITHUB_EVENT_NAME = "push";
      const result = getBaseRef();
      expect(result).toBe("HEAD~1");
    });

    test("returns main for PR events without event file", () => {
      process.env.GITHUB_EVENT_NAME = "pull_request";
      delete process.env.GITHUB_EVENT_PATH;
      const result = getBaseRef();
      expect(result).toBe("main");
    });

    test("extracts base SHA from PR event", () => {
      process.env.GITHUB_EVENT_NAME = "pull_request";
      process.env.GITHUB_EVENT_PATH = "/tmp/event.json";

      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          pull_request: {
            base: {
              sha: "abc123def456",
            },
          },
        }),
      );

      const result = getBaseRef();
      expect(result).toBe("abc123def456");
      expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/event.json", "utf8");
    });

    test("falls back to main on JSON parse error", () => {
      process.env.GITHUB_EVENT_NAME = "pull_request";
      process.env.GITHUB_EVENT_PATH = "/tmp/invalid.json";

      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = getBaseRef();
      expect(result).toBe("main");
    });
  });

  describe("getChangedFiles", () => {
    test("returns files from successful git diff", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("file1.js\nfile2.ts\n");

      const result = getChangedFiles("main");
      expect(result).toEqual(["file1.js", "file2.ts"]);
    });

    test("tries multiple git commands on failure", () => {
      vi.mocked(childProcess.execSync)
        .mockImplementationOnce(() => {
          throw new Error("Command failed");
        })
        .mockImplementationOnce(() => {
          throw new Error("Command failed");
        })
        .mockReturnValue("recovered-file.js\n");

      const result = getChangedFiles("main");
      expect(result).toEqual(["recovered-file.js"]);
      expect(childProcess.execSync).toHaveBeenCalledTimes(3);
    });

    test("returns wildcard on complete failure", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("Git not available");
      });

      const result = getChangedFiles("main");
      expect(result).toEqual(["**/*"]);
    });

    test("filters out empty lines", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("file1.js\n\nfile2.ts\n\n");

      const result = getChangedFiles("main");
      expect(result).toEqual(["file1.js", "file2.ts"]);
    });
  });

  describe("isFusionApp", () => {
    test("returns false for packages without Fusion deps", () => {
      const packageJson = {
        dependencies: {
          react: "^18.0.0",
        },
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(false);
    });

    test("returns true for packages with fusion-framework-cli", () => {
      const packageJson = {
        dependencies: {
          "@equinor/fusion-framework-cli": "^1.0.0",
        },
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(true);
    });

    test("returns true for packages with fusion deps and app scripts", () => {
      const packageJson = {
        dependencies: {
          "@equinor/fusion-components": "^1.0.0",
        },
        scripts: {
          build: "fusion-framework-cli build",
          start: "fusion-framework-cli start",
        },
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(true);
    });

    test("returns true for packages with fusion config", () => {
      const packageJson = {
        dependencies: {
          "@equinor/fusion-components": "^1.0.0",
        },
        fusion: {
          appKey: "my-app",
        },
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(true);
    });

    test("returns false for publishable libraries", () => {
      const packageJson = {
        dependencies: {
          "@equinor/fusion-components": "^1.0.0",
        },
        main: "dist/index.js",
        private: false,
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(false);
    });

    test("returns true for private packages with fusion deps", () => {
      const packageJson = {
        dependencies: {
          "@equinor/fusion-components": "^1.0.0",
        },
        private: true,
      };

      const result = isFusionApp(packageJson);
      expect(result).toBe(true);
    });
  });

  describe("findFusionApps", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue(["app1", "app2"] as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          name: "test-app",
          dependencies: {
            "@equinor/fusion-framework-cli": "^1.0.0",
          },
        }),
      );
    });

    test("finds apps with glob patterns", () => {
      const result = findFusionApps(["apps/*"]);

      expect(fs.existsSync).toHaveBeenCalledWith("apps");
      expect(fs.readdirSync).toHaveBeenCalledWith("apps");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "test-app",
        path: "apps/app1",
      });
    });

    test("handles direct path patterns", () => {
      // For direct paths, it checks the directory itself, not subdirs
      const result = findFusionApps(["specific-app"]);

      expect(fs.existsSync).toHaveBeenCalledWith("specific-app");
      // Since the mock returns a valid package.json for a fusion app, we expect 1 result
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test-app",
        path: "specific-app",
      });
    });

    test("warns about non-existent paths", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = findFusionApps(["nonexistent/*"]);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Base path does not exist"),
      );
    });

    test("filters non-fusion apps", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          name: "regular-app",
          dependencies: {
            react: "^18.0.0",
          },
        }),
      );

      const result = findFusionApps(["apps/*"]);
      expect(result).toHaveLength(0);
    });
  });

  describe("findChangedApps", () => {
    const apps = [
      { name: "app1", path: "apps/app1" },
      { name: "app2", path: "packages/app2" },
    ];

    test("identifies apps with changes", () => {
      const changedFiles = ["apps/app1/src/index.ts", "other/file.js"];

      const result = findChangedApps(changedFiles, apps);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(apps[0]);
    });

    test("handles normalized paths", () => {
      const changedFiles = ["./packages/app2/package.json"];

      const result = findChangedApps(changedFiles, apps);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(apps[1]);
    });

    test("handles wildcard changes", () => {
      const changedFiles = ["**/*"];

      const result = findChangedApps(changedFiles, apps);
      expect(result).toHaveLength(2);
    });

    test("returns empty for no matches", () => {
      const changedFiles = ["unrelated/file.js", "docs/README.md"];

      const result = findChangedApps(changedFiles, apps);
      expect(result).toHaveLength(0);
    });
  });

  describe("setOutputs", () => {
    test("sets all outputs correctly", () => {
      const changedApps = [
        { name: "app1", path: "apps/app1" },
        { name: "app2", path: "apps/app2" },
      ];
      const changedFiles = ["apps/app1/src/index.ts"];

      setOutputs(changedApps, changedFiles);

      expect(core.setOutput).toHaveBeenCalledWith("changed-apps", JSON.stringify(changedApps));
      expect(core.setOutput).toHaveBeenCalledWith("changed-app-names", "app1,app2");
      expect(core.setOutput).toHaveBeenCalledWith("has-changes", "true");
      expect(core.setOutput).toHaveBeenCalledWith("changed-apps-count", "2");
    });

    test("handles no changes", () => {
      setOutputs([], []);

      expect(core.setOutput).toHaveBeenCalledWith("has-changes", "false");
      expect(core.setOutput).toHaveBeenCalledWith("changed-apps-count", "0");
      expect(core.setOutput).toHaveBeenCalledWith("summary", "No Fusion apps changed");
    });
  });
});
