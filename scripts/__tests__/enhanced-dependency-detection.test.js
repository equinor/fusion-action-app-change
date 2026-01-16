const { isLocalDependency, extractPackageNameFromLocalDep } = require("../lib/dependency-graph");

describe("Enhanced Local Dependency Detection", () => {
  
  describe("isLocalDependency", () => {
    test("should detect workspace dependencies", () => {
      expect(isLocalDependency("workspace:*")).toBe(true);
      expect(isLocalDependency("workspace:^1.0.0")).toBe(true);
      expect(isLocalDependency("workspace:~1.0.0")).toBe(true);
    });

    test("should detect file dependencies", () => {
      expect(isLocalDependency("file:../packages/shared")).toBe(true);
      expect(isLocalDependency("file:./local-package")).toBe(true);
    });

    test("should detect relative path dependencies", () => {
      expect(isLocalDependency("../packages/shared")).toBe(true);
      expect(isLocalDependency("./local-package")).toBe(true);
    });

    test("should not detect regular npm dependencies", () => {
      expect(isLocalDependency("^1.0.0")).toBe(false);
      expect(isLocalDependency("~2.0.0")).toBe(false);
      expect(isLocalDependency("latest")).toBe(false);
    });

    test("should handle git dependencies with local indicators", () => {
      expect(isLocalDependency("git+file:///absolute/path")).toBe(true);
      expect(isLocalDependency("git+ssh://git@localhost/repo")).toBe(true);
      expect(isLocalDependency("git+https://github.com/user/repo")).toBe(false);
    });
  });

  describe("extractPackageNameFromLocalDep", () => {
    test("should extract name from workspace dependencies", () => {
      const result = extractPackageNameFromLocalDep(
        "@equinor/fusion-portal-extensions-actions",
        "workspace:*",
        "/apps/portal/package.json"
      );
      expect(result).toBe("@equinor/fusion-portal-extensions-actions");
    });

    test("should handle workspace protocol variations", () => {
      const result = extractPackageNameFromLocalDep(
        "@company/shared-lib",
        "workspace:^1.0.0",
        "/apps/app1/package.json"
      );
      expect(result).toBe("@company/shared-lib");
    });

    // Note: file: and relative path tests would require actual filesystem setup
    // These are more integration-test level scenarios
  });

});