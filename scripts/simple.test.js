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
    promises: {
      access: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  };
});
jest.mock("node:child_process", () => ({
  execSync: jest.fn(),
}));

const mockCore = require("@actions/core");
const mockFs = require("node:fs");
const mockChildProcess = require("node:child_process");

describe("Fusion App Change Detection - Simple Tests", () => {
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

  describe("isFusionApp", () => {
    test("should return false for non-Fusion packages", () => {
      const packageJson = {
        name: "regular-app",
        dependencies: { react: "^18.0.0" },
      };

      const result = indexModule.isFusionApp(packageJson);

      expect(result).toBe(false);
    });

    test("should return true for Fusion apps with CLI", () => {
      const packageJson = {
        name: "fusion-app",
        dependencies: { "@equinor/fusion-framework": "^1.0.0" },
        devDependencies: { "@equinor/fusion-framework-cli": "^1.0.0" },
      };

      const result = indexModule.isFusionApp(packageJson);

      expect(result).toBe(true);
    });

    test("should return true for private Fusion apps", () => {
      const packageJson = {
        name: "fusion-app",
        private: true,
        dependencies: { "@equinor/fusion-framework": "^1.0.0" },
      };

      const result = indexModule.isFusionApp(packageJson);

      expect(result).toBe(true);
    });

    test("should return false for publishable libraries", () => {
      const packageJson = {
        name: "@company/fusion-lib",
        main: "dist/index.js",
        private: false,
        dependencies: { "@equinor/fusion-framework": "^1.0.0" },
      };

      const result = indexModule.isFusionApp(packageJson);

      expect(result).toBe(false);
    });
  });

  describe("getBaseRef", () => {
    test("should return HEAD~1 for push events", () => {
      process.env.GITHUB_EVENT_NAME = "push";

      const result = indexModule.getBaseRef();

      expect(result).toBe("HEAD~1");
    });

    test("should return PR base SHA", () => {
      process.env.GITHUB_EVENT_NAME = "pull_request";
      process.env.GITHUB_EVENT_PATH = "/mock/event.json";

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pull_request: { base: { sha: "abc123" } },
        }),
      );

      const result = indexModule.getBaseRef();

      expect(result).toBe("abc123");
    });
  });

  describe("getChangedFiles", () => {
    test("should return files from git diff", () => {
      mockChildProcess.execSync.mockReturnValue("app1/file.ts\napp2/file.js\n");

      const result = indexModule.getChangedFiles("main");

      expect(result).toEqual(["app1/file.ts", "app2/file.js"]);
    });

    test("should handle git failures with fallback", () => {
      mockChildProcess.execSync.mockImplementation(() => {
        throw new Error("Git failed");
      });

      const result = indexModule.getChangedFiles("main");

      expect(result).toEqual(["**/*"]);
      expect(mockCore.warning).toHaveBeenCalled();
    });

    test("should safely handle malicious baseRef input", () => {
      mockChildProcess.execSync.mockReturnValue("app1/file.ts\napp2/file.js\n");

      // Test with potentially dangerous input that could cause command injection
      const maliciousInput = "main; rm -rf /; echo dangerous";
      const result = indexModule.getChangedFiles(maliciousInput);

      expect(result).toEqual(["app1/file.ts", "app2/file.js"]);

      // Verify that execSync was called with safely escaped input
      expect(mockChildProcess.execSync).toHaveBeenCalledWith(
        expect.stringContaining("'main; rm -rf /; echo dangerous'"),
        expect.any(Object),
      );
    });
  });

  describe("findChangedApps", () => {
    test("should match changed files to apps", () => {
      const changedFiles = ["apps/app1/src/file.ts", "apps/app3/README.md"];
      const allApps = [
        { name: "app1", path: "apps/app1" },
        { name: "app2", path: "apps/app2" },
        { name: "app3", path: "apps/app3" },
      ];

      const result = indexModule.findChangedApps(changedFiles, allApps);

      expect(result).toHaveLength(2);
      expect(result.map((app) => app.name).sort()).toEqual(["app1", "app3"]);
    });
  });

  describe("setOutputs", () => {
    test("should set correct outputs for changed apps", () => {
      const changedApps = [
        { name: "app1", path: "apps/app1" },
        { name: "app2", path: "apps/app2" },
      ];
      const changedFiles = ["apps/app1/package.json", "apps/app2/src/index.js"];

      indexModule.setOutputs(changedApps, changedFiles);

      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps", JSON.stringify(changedApps));
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-app-names", "app1,app2");
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        "changed-app-paths",
        JSON.stringify(["apps/app1", "apps/app2"]),
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        "changed-files",
        JSON.stringify(changedFiles),
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith("has-changes", "true");
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        "summary",
        "2 apps changed: app1, app2",
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith("app-types", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        "matrix",
        JSON.stringify({ 
          include: [
            { name: "app1", path: "apps/app1", changeReason: "direct" },
            { name: "app2", path: "apps/app2", changeReason: "direct" }
          ]
        }),
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps-count", "2");
    });

    test("should handle no changes", () => {
      indexModule.setOutputs([], []);

      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-app-names", "");
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-app-paths", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-files", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith("has-changes", "false");
      expect(mockCore.setOutput).toHaveBeenCalledWith("summary", "No Fusion apps changed");
      expect(mockCore.setOutput).toHaveBeenCalledWith("app-types", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith("matrix", JSON.stringify({ include: [] }));
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps-count", "0");
      expect(mockCore.setOutput).toHaveBeenCalledWith("affected-by-dependencies", JSON.stringify([]));
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-libraries", JSON.stringify([]));
    });

    test("should handle single app change correctly", () => {
      const changedApps = [{ name: "single-app", path: "apps/single-app" }];

      indexModule.setOutputs(changedApps, []);

      expect(mockCore.setOutput).toHaveBeenCalledWith(
        "summary",
        "1 app changed: single-app",
      );
    });
  });

  describe("integration test", () => {
    test("should run end-to-end detection", async () => {
      // Mock successful scenario
      mockCore.getInput.mockImplementation((input) => {
        if (input === "app-paths") return "apps/*";
        return "";
      });

      process.env.GITHUB_EVENT_NAME = "push";

      // Mock file system
      mockFs.existsSync.mockImplementation((path) => {
        return (
          path === "apps" || path === "apps/fusion-app" || path === "apps/fusion-app/package.json"
        );
      });

      mockFs.lstatSync.mockImplementation((path) => ({
        isDirectory: () => !path.endsWith(".json"),
      }));

      mockFs.readdirSync.mockReturnValue(["fusion-app"]);

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: "my-fusion-app",
          private: true,
          dependencies: { "@equinor/fusion-framework": "^1.0.0" },
        }),
      );

      // Mock git diff
      mockChildProcess.execSync.mockReturnValue("apps/fusion-app/src/index.ts\n");

      await indexModule.run();

      expect(mockCore.setOutput).toHaveBeenCalledWith("has-changes", "true");
      expect(mockCore.setOutput).toHaveBeenCalledWith("changed-apps-count", "1");
      expect(mockCore.info).toHaveBeenCalledWith("📦 1 apps changed: my-fusion-app");
    });
  });
});
