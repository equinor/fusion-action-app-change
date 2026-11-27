import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(__dirname, "..");
const releaseScriptPath = path.join(repoRoot, ".github", "scripts", "release-tags.sh");
const ciWorkflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");
const releaseWorkflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GIT_AUTHOR_NAME: "Test Author",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test Committer",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

interface MockGhCall {
  args: string[];
  notes?: string;
}

interface Fixture {
  root: string;
  originDir: string;
  workDir: string;
  ghBinDir: string;
  ghLogPath: string;
  existingReleasesPath: string;
  commit: (message: string, files: Record<string, string>) => string;
  runScript: (args?: string[]) => { status: number | null; stdout: string; stderr: string };
  remoteTagSha: (tag: string) => string;
  ghCalls: () => MockGhCall[];
}

function createGitFixture(initialVersion: string, initialChangelog: string): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "fusion-change-release-tags-test-"));
  temporaryDirectories.push(root);

  const originDir = path.join(root, "origin.git");
  const workDir = path.join(root, "work");
  const ghBinDir = path.join(root, "bin");
  const ghLogPath = path.join(root, "gh-calls.jsonl");
  const existingReleasesPath = path.join(root, "existing-releases.txt");

  git(root, ["init", "--bare", originDir]);
  git(originDir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(root, ["clone", originDir, workDir]);
  git(workDir, ["checkout", "-B", "main"]);

  writeFileSync(existingReleasesPath, "", "utf8");
  writeFileSync(ghLogPath, "", "utf8");

  spawnSync("mkdir", ["-p", ghBinDir]);
  const ghStubPath = path.join(ghBinDir, "gh");
  writeFileSync(
    ghStubPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const logPath = process.env.MOCK_GH_LOG;
const releasesPath = process.env.MOCK_GH_RELEASES;
const existing = new Set(
  fs.readFileSync(releasesPath, "utf8").split(/\\r?\\n/).filter(Boolean),
);

if (args[0] === "release" && args[1] === "view") {
  const tag = args[2];
  fs.appendFileSync(logPath, JSON.stringify({ args }) + "\\n");
  process.exit(existing.has(tag) ? 0 : 1);
}

if (args[0] === "release" && args[1] === "create") {
  const tag = args[2];
  const notesIndex = args.indexOf("--notes-file");
  const notes = notesIndex >= 0 ? fs.readFileSync(args[notesIndex + 1], "utf8") : undefined;
  fs.appendFileSync(logPath, JSON.stringify({ args, notes }) + "\\n");
  existing.add(tag);
  fs.writeFileSync(releasesPath, Array.from(existing).join("\\n") + "\\n");
  process.exit(0);
}

console.error("Unexpected gh invocation:", args);
process.exit(2);
`,
    "utf8",
  );
  chmodSync(ghStubPath, 0o755);

  const commit = (message: string, files: Record<string, string>): string => {
    for (const [relativePath, content] of Object.entries(files)) {
      writeFileSync(path.join(workDir, relativePath), content, "utf8");
    }
    git(workDir, ["add", "."]);
    git(workDir, ["commit", "-m", message]);
    return git(workDir, ["rev-parse", "HEAD"]);
  };

  commit(`Version Packages (${initialVersion})`, {
    "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: initialVersion, private: true }, null, 2)}\n`,
    "CHANGELOG.md": initialChangelog,
  });
  git(workDir, ["push", "-u", "origin", "main"]);

  const runScript = (args: string[] = []) => {
    const result = spawnSync("bash", [releaseScriptPath, ...args], {
      cwd: workDir,
      encoding: "utf8",
      timeout: 10000,
      env: {
        PATH: `${ghBinDir}:${process.env.PATH ?? ""}`,
        MOCK_GH_LOG: ghLogPath,
        MOCK_GH_RELEASES: existingReleasesPath,
      },
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };

  const remoteTagSha = (tag: string): string => {
    const out = git(workDir, [
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ]);
    if (!out) return "";
    const lines = out.split(/\r?\n/).filter(Boolean);
    const peeled = lines.find((line) => line.endsWith("^{}"));
    return (peeled ?? lines[0]).split(/\s+/)[0];
  };

  const ghCalls = (): MockGhCall[] =>
    readFileSync(ghLogPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MockGhCall);

  return {
    root,
    originDir,
    workDir,
    ghBinDir,
    ghLogPath,
    existingReleasesPath,
    commit,
    runScript,
    remoteTagSha,
    ghCalls,
  };
}

describe("CI release tag and GitHub Release automation", () => {
  it("separates Changesets PR management in ci.yml from release publication in release.yml", () => {
    const ciWorkflow = readFileSync(ciWorkflowPath, "utf8");
    const releaseWorkflow = readFileSync(releaseWorkflowPath, "utf8");

    expect(ciWorkflow).toContain("pr-title: '🤖 Release - Fusion Action App Change'");
    expect(ciWorkflow).toContain("create-github-releases: false");
    expect(ciWorkflow).toContain("push-with-git-cli: true");
    expect(ciWorkflow).toContain("version-script: pnpm run changeset:version");
    expect(ciWorkflow).toContain("steps.changesets.outputs.has-changesets");
    expect(ciWorkflow).toContain("steps.changesets.outputs.pr-number");
    expect(ciWorkflow).not.toContain("release-tags.sh");
    expect(ciWorkflow).not.toContain("createGithubReleases:");
    expect(ciWorkflow).not.toContain("setupGitUser:");
    expect(ciWorkflow).not.toContain("steps.changesets.outputs.hasChangesets");
    expect(ciWorkflow).not.toContain("steps.changesets.outputs.pullRequestNumber");
    expect(ciWorkflow).not.toMatch(/git tag -f\b/);
    expect(ciWorkflow).not.toContain("git push origin --tags --force");

    expect(releaseWorkflow).toContain("types: [closed]");
    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("github.ref == 'refs/heads/main'");
    expect(releaseWorkflow).toContain("github.event.pull_request.merged == true");
    expect(releaseWorkflow).toContain("github.event.pull_request.base.ref == 'main'");
    expect(releaseWorkflow).toContain(
      "github.event.pull_request.head.ref == 'changeset-release/main'",
    );
    expect(releaseWorkflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(releaseWorkflow).toContain("github.event.pull_request.merge_commit_sha");
    expect(releaseWorkflow).not.toMatch(/^concurrency:/m);
    expect(releaseWorkflow).toContain("    concurrency:\n      group: release-main");
    expect(releaseWorkflow).toContain("--resolve-release-sha");
    expect(releaseWorkflow).toMatch(/git checkout --detach "\$\{RELEASE_SHA\}"/);
    expect(releaseWorkflow).toContain("run: pnpm test");
    expect(releaseWorkflow).toContain("run: pnpm run lint");
    expect(releaseWorkflow).toContain("run: pnpm run build");
    expect(releaseWorkflow.indexOf("--resolve-release-sha")).toBeLessThan(
      releaseWorkflow.indexOf("uses: $/.github/actions/node-setup"),
    );
    expect(releaseWorkflow.indexOf("run: pnpm run build")).toBeLessThan(
      releaseWorkflow.indexOf("Create GitHub Release and Update Action Tags"),
    );
    expect(releaseWorkflow).toMatch(/bash "\$\{RUNNER_TEMP\}\/release-tags\.sh"/);
    expect(releaseWorkflow).not.toMatch(/git tag -f\b/);
    expect(releaseWorkflow).not.toContain("git push origin --tags --force");
  });

  it("does not overwrite an existing release tag or move floating aliases on non-release commits", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);

    const initialRun = fixture.runScript();
    expect(initialRun.status).toBe(0);
    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);

    const ciOnlySha = fixture.commit("chore(deps): bump actions/checkout", {
      "README.md": "updated docs only\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);
    git(fixture.workDir, ["tag", "-d", "v2.0.0"]);

    const createCallsBefore = fixture
      .ghCalls()
      .filter((call) => call.args[0] === "release" && call.args[1] === "create").length;

    const directNonReleaseRun = fixture.runScript();
    expect(directNonReleaseRun.status).toBe(1);
    expect(directNonReleaseRun.stderr).toContain("does not match the version-introducing commit");
    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0.0")).not.toBe(ciOnlySha);

    const resolved = fixture.runScript(["--resolve-release-sha"]);
    expect(resolved.status).toBe(0);
    expect(resolved.stdout.trim()).toBe(v200Sha);

    git(fixture.workDir, ["checkout", "--detach", resolved.stdout.trim()]);
    const idempotentRun = fixture.runScript();
    expect(idempotentRun.status).toBe(0);
    expect(idempotentRun.stdout).toContain(`already points to release commit (${v200Sha})`);
    expect(idempotentRun.stdout).toContain("GitHub Release v2.0.0 already exists");
    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);
    const createCallsAfter = fixture
      .ghCalls()
      .filter((call) => call.args[0] === "release" && call.args[1] === "create").length;
    expect(createCallsAfter).toBe(createCallsBefore);
  });

  it("refuses to publish an earlier release SHA until checked out, then recovers cleanly via --resolve-release-sha", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    expect(fixture.runScript().status).toBe(0);

    // Version-bump commit lands, but its CI run fails or is dropped before tagging.
    const versionBumpSha = fixture.commit("Version Packages (2.0.1)", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md":
        "# fusion-action-app-change\n\n## 2.0.1\n\n### Patch Changes\n\n- Fix 2.0.1\n\n## 2.0.0\n\n- Initial 2.0.0 release\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    // Later non-release commit advances main.
    const followUpDocsSha = fixture.commit("docs: clarify readme", {
      "README.md": "follow-up docs\n",
      "CHANGELOG.md":
        "# fusion-action-app-change\n\n## 2.0.1\n\n### Patch Changes\n\n- Mutated later docs\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    // Without checking out RELEASE_SHA first, release-tags.sh refuses to tag an unvalidated earlier commit.
    const unvalidatedRun = fixture.runScript();
    expect(unvalidatedRun.status).toBe(1);
    expect(unvalidatedRun.stderr).toContain("does not match the version-introducing commit");
    expect(fixture.remoteTagSha("v2.0.1")).toBe("");
    expect(fixture.remoteTagSha("v2.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);

    // Resolving RELEASE_SHA first allows release.yml to check it out, validate it, and then publish it.
    const resolved = fixture.runScript(["--resolve-release-sha"]);
    expect(resolved.status).toBe(0);
    expect(resolved.stdout.trim()).toBe(versionBumpSha);

    git(fixture.workDir, ["checkout", "--detach", resolved.stdout.trim()]);
    const recoveryRun = fixture.runScript();

    expect(recoveryRun.status).toBe(0);
    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0.1")).toBe(versionBumpSha);
    expect(fixture.remoteTagSha("v2.0.1")).not.toBe(followUpDocsSha);
    expect(fixture.remoteTagSha("v2.0")).toBe(versionBumpSha);
    expect(fixture.remoteTagSha("v2")).toBe(versionBumpSha);

    const v201Release = fixture
      .ghCalls()
      .find((call) => call.args[1] === "create" && call.args[2] === "v2.0.1");
    expect(v201Release?.notes).toContain("Fix 2.0.1");
    expect(v201Release?.notes).not.toContain("Mutated later docs");

    // Another follow-up non-release commit stays idempotent when resolved & checked out.
    const createCallsAfterRecovery = fixture
      .ghCalls()
      .filter((call) => call.args[0] === "release" && call.args[1] === "create").length;
    git(fixture.workDir, ["checkout", "main"]);
    fixture.commit("docs: second follow-up", {
      "README.md": "second follow-up docs\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    const resolvedAgain = fixture.runScript(["--resolve-release-sha"]);
    expect(resolvedAgain.status).toBe(0);
    expect(resolvedAgain.stdout.trim()).toBe(versionBumpSha);

    git(fixture.workDir, ["checkout", "--detach", resolvedAgain.stdout.trim()]);
    const subsequentRun = fixture.runScript();
    expect(subsequentRun.status).toBe(0);
    expect(subsequentRun.stdout).toContain(`already points to release commit (${versionBumpSha})`);
    expect(subsequentRun.stdout).toContain("GitHub Release v2.0.1 already exists");
    expect(fixture.remoteTagSha("v2.0.1")).toBe(versionBumpSha);
    expect(
      fixture.ghCalls().filter((call) => call.args[0] === "release" && call.args[1] === "create")
        .length,
    ).toBe(createCallsAfterRecovery);
  });

  it("finishes incomplete GitHub Release and floating alias updates on retry after main advances", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    expect(fixture.runScript().status).toBe(0);

    // Version-bump commit lands and its tag push succeeds, but Release creation and alias pushes fail.
    const versionBumpSha = fixture.commit("Version Packages (2.0.1)", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md":
        "# fusion-action-app-change\n\n## 2.0.1\n\n### Patch Changes\n\n- Partial failure fix 2.0.1\n\n## 2.0.0\n\n- Initial 2.0.0 release\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);
    git(fixture.workDir, ["tag", "v2.0.1", versionBumpSha]);
    git(fixture.workDir, ["push", "origin", "refs/tags/v2.0.1"]);

    // Verify pre-retry partial state: v2.0.1 tag exists, but v2.0/v2 are still on v2.0.0 and no v2.0.1 Release exists.
    expect(fixture.remoteTagSha("v2.0.1")).toBe(versionBumpSha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);

    // Main advances with a non-release commit before retry runs.
    const followUpSha = fixture.commit("docs: update after partial failure", {
      "README.md": "after partial failure\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    const resolved = fixture.runScript(["--resolve-release-sha"]);
    expect(resolved.status).toBe(0);
    expect(resolved.stdout.trim()).toBe(versionBumpSha);

    git(fixture.workDir, ["checkout", "--detach", resolved.stdout.trim()]);
    const retryRun = fixture.runScript();
    expect(retryRun.status).toBe(0);
    expect(retryRun.stdout).toContain(`already points to release commit (${versionBumpSha})`);
    expect(fixture.remoteTagSha("v2.0.1")).toBe(versionBumpSha);
    expect(fixture.remoteTagSha("v2.0.1")).not.toBe(followUpSha);
    expect(fixture.remoteTagSha("v2.0")).toBe(versionBumpSha);
    expect(fixture.remoteTagSha("v2")).toBe(versionBumpSha);

    const v201Release = fixture
      .ghCalls()
      .find((call) => call.args[1] === "create" && call.args[2] === "v2.0.1");
    expect(v201Release).toBeDefined();
    expect(v201Release?.notes).toContain("Partial failure fix 2.0.1");
  });

  it("publishes a new unused patch version from a merge commit with matching changelog release notes while preserving prior tags", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    expect(fixture.runScript().status).toBe(0);

    // Simulate merging a changeset-release/main PR into main with a merge commit.
    git(fixture.workDir, ["checkout", "-b", "changeset-release/main"]);
    fixture.commit("Version Packages", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md": [
        "# fusion-action-app-change",
        "",
        "## 2.0.1",
        "",
        "### Patch Changes",
        "",
        "- Keep published vX.Y.Z tags immutable and publish GitHub Releases.",
        "",
        "## 2.0.0",
        "",
        "### Major Changes",
        "",
        "- Initial 2.0.0 release",
        "",
      ].join("\n"),
    });
    git(fixture.workDir, ["checkout", "main"]);
    git(fixture.workDir, [
      "merge",
      "--no-ff",
      "changeset-release/main",
      "-m",
      "Merge pull request #46 from equinor/changeset-release/main",
    ]);
    const v201MergeSha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    git(fixture.workDir, ["push", "origin", "main"]);

    const releaseRun = fixture.runScript();
    expect(releaseRun.status).toBe(0);

    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0.1")).toBe(v201MergeSha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v201MergeSha);
    expect(fixture.remoteTagSha("v2")).toBe(v201MergeSha);

    const createCalls = fixture
      .ghCalls()
      .filter((call) => call.args[0] === "release" && call.args[1] === "create");
    const v201Release = createCalls.find((call) => call.args[2] === "v2.0.1");

    expect(v201Release).toBeDefined();
    expect(v201Release?.args).toContain("--verify-tag");
    expect(v201Release?.args).toContain("--title");
    expect(v201Release?.notes).toContain("Keep published vX.Y.Z tags immutable");
    expect(v201Release?.notes).not.toContain("Initial 2.0.0 release");
  });

  it("retries GitHub Release creation idempotently without moving newer floating aliases backwards", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    expect(fixture.runScript().status).toBe(0);

    const v201Sha = fixture.commit("Version Packages (2.0.1)", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md":
        "# fusion-action-app-change\n\n## 2.0.1\n\n### Patch Changes\n\n- Fix 2.0.1\n\n## 2.0.0\n\n- Initial 2.0.0 release\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);
    expect(fixture.runScript().status).toBe(0);

    git(fixture.workDir, ["checkout", v200Sha]);
    writeFileSync(fixture.existingReleasesPath, "v2.0.1\n", "utf8");

    const retryRun = fixture.runScript();
    expect(retryRun.status).toBe(0);
    expect(fixture.remoteTagSha("v2.0.0")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.0")).toBe(v201Sha);
    expect(fixture.remoteTagSha("v2")).toBe(v201Sha);
  });

  it("refuses to move floating aliases backwards when a concurrent publisher advances them after the snapshot", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    expect(fixture.runScript().status).toBe(0);

    const v201Sha = fixture.commit("Version Packages (2.0.1)", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md":
        "# fusion-action-app-change\n\n## 2.0.1\n\n### Patch Changes\n\n- Fix 2.0.1\n\n## 2.0.0\n\n- Initial 2.0.0 release\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    // Prepare a concurrent v2.0.2 commit in the bare origin repository.
    const concurrentDir = path.join(fixture.root, "concurrent");
    git(fixture.root, ["clone", "--branch", "main", fixture.originDir, concurrentDir]);
    writeFileSync(
      path.join(concurrentDir, "package.json"),
      `${JSON.stringify({ name: "fusion-action-app-change", version: "2.0.2", private: true }, null, 2)}\n`,
      "utf8",
    );
    git(concurrentDir, ["add", "package.json"]);
    git(concurrentDir, ["commit", "-m", "Version Packages (2.0.2)"]);
    const concurrentV202Sha = git(concurrentDir, ["rev-parse", "HEAD"]);
    git(concurrentDir, ["push", "origin", "main"]);

    // Wrap git so that right after release-tags.sh reads ALL_MAJOR_TAGS (refs/tags/v2.*),
    // the concurrent publisher advances v2.0 and v2 on origin to v2.0.2.
    const realGit = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
    const wrapperDir = path.join(fixture.root, "race-bin");
    spawnSync("mkdir", ["-p", wrapperDir]);
    const gitWrapperPath = path.join(wrapperDir, "git");
    writeFileSync(
      gitWrapperPath,
      `#!/usr/bin/env bash
set -euo pipefail
"${realGit}" "$@"
if [[ "$*" == *"ls-remote --tags origin refs/tags/v2.*"* ]]; then
  "${realGit}" --git-dir="${fixture.originDir}" update-ref refs/tags/v2.0.2 "${concurrentV202Sha}"
  "${realGit}" --git-dir="${fixture.originDir}" update-ref refs/tags/v2.0 "${concurrentV202Sha}"
  "${realGit}" --git-dir="${fixture.originDir}" update-ref refs/tags/v2 "${concurrentV202Sha}"
fi
`,
      "utf8",
    );
    chmodSync(gitWrapperPath, 0o755);

    const raceResult = spawnSync("bash", [releaseScriptPath], {
      cwd: fixture.workDir,
      encoding: "utf8",
      timeout: 10000,
      env: {
        PATH: `${wrapperDir}:${fixture.ghBinDir}:${process.env.PATH ?? ""}`,
        MOCK_GH_LOG: fixture.ghLogPath,
        MOCK_GH_RELEASES: fixture.existingReleasesPath,
      },
    });

    expect(raceResult.status).not.toBe(0);
    expect(fixture.remoteTagSha("v2.0.1")).toBe(v201Sha);
    // Floating aliases must remain at concurrent v2.0.2, never regressed to v2.0.1.
    expect(fixture.remoteTagSha("v2.0")).toBe(concurrentV202Sha);
    expect(fixture.remoteTagSha("v2")).toBe(concurrentV202Sha);
  });

  it("marks prereleases with --prerelease and never moves floating major/minor tags", () => {
    const fixture = createGitFixture(
      "2.0.0",
      "# fusion-action-app-change\n\n## 2.0.0\n\n### Major Changes\n\n- Initial 2.0.0 release\n",
    );
    const v200Sha = git(fixture.workDir, ["rev-parse", "HEAD"]);
    expect(fixture.runScript().status).toBe(0);

    const rcSha = fixture.commit("Version Packages (2.1.0-rc.1)", {
      "package.json": `${JSON.stringify({ name: "fusion-action-app-change", version: "2.1.0-rc.1", private: true }, null, 2)}\n`,
      "CHANGELOG.md": "# fusion-action-app-change\n\n## 2.1.0-rc.1\n\n- Release candidate\n",
    });
    git(fixture.workDir, ["push", "origin", "main"]);

    const rcRun = fixture.runScript();
    expect(rcRun.status).toBe(0);
    expect(fixture.remoteTagSha("v2.1.0-rc.1")).toBe(rcSha);
    expect(fixture.remoteTagSha("v2")).toBe(v200Sha);
    expect(fixture.remoteTagSha("v2.1")).toBe("");

    const rcRelease = fixture
      .ghCalls()
      .find((call) => call.args[1] === "create" && call.args[2] === "v2.1.0-rc.1");
    expect(rcRelease?.args).toContain("--prerelease");
  });

  it.each([
    "not-a-semver",
    "02.0.1",
    "2.00.1",
    "2.0.01",
    "2.1.0-01",
    "2.1.0-rc..1",
    "2.1.0-",
    "2.1.0-rc.1.",
  ])("fails loudly if package.json contains malformed semantic version %s", (malformedVersion) => {
    const fixture = createGitFixture(malformedVersion, "# fusion-action-app-change\n");
    const result = fixture.runScript();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid semantic version");
    expect(fixture.ghCalls()).toHaveLength(0);
  });
});
