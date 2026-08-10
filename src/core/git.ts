import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as core from "@actions/core";
import type { GitComparison, GitHubEventPullRequest } from "../types/index.js";

/**
 * Determines the appropriate git reference to use as the base for comparison.
 *
 * The base reference selection strategy:
 * - For pull requests: Uses the base branch SHA from the PR event
 * - For pushes: Uses the previous commit (HEAD~1)
 * - Falls back to 'main' branch if event parsing fails
 */
export const getBaseRef = (): string => {
  // Smart base ref detection based on event type
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === "pull_request") {
    try {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath) {
        const event = JSON.parse(fs.readFileSync(eventPath, "utf8")) as GitHubEventPullRequest;
        return event.pull_request?.base?.sha || "main";
      }
      // No event path available, fallback to main
      return "main";
    } catch {
      return "main";
    }
  }

  return "HEAD~1";
};

/**
 * Resolves the files and effective base reference used to compare against HEAD.
 *
 * Uses multiple git diff strategies to ensure robust file detection:
 * 1. git diff --name-only baseRef...HEAD (preferred for PRs)
 * 2. git diff --name-only baseRef HEAD (fallback)
 * 3. git diff --name-only HEAD~1 HEAD (last resort)
 */
export const getGitComparison = (baseRef: string): GitComparison => {
  try {
    const strategies = [
      { baseRef, args: ["diff", "--name-only", `${baseRef}...HEAD`], useMergeBase: true },
      { baseRef, args: ["diff", "--name-only", baseRef, "HEAD"], useMergeBase: false },
      {
        baseRef: "HEAD~1",
        args: ["diff", "--name-only", "HEAD~1", "HEAD"],
        useMergeBase: false,
      },
    ];

    for (const strategy of strategies) {
      try {
        const output = execFileSync("git", strategy.args, {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        });
        const files = output.split("\n").filter((file) => file.trim());
        const effectiveBaseRef = strategy.useMergeBase
          ? execFileSync("git", ["merge-base", strategy.baseRef, "HEAD"], {
              encoding: "utf8",
              stdio: ["pipe", "pipe", "ignore"],
            }).trim()
          : strategy.baseRef;
        return { baseRef: effectiveBaseRef, changedFiles: files };
      } catch {
        // Continue to the next comparison strategy.
      }
    }

    core.warning("⚠️ Could not determine changed files, assuming all apps may be affected");
    return { baseRef, changedFiles: ["**/*"] };
  } catch (error) {
    core.warning(`⚠️ Git diff failed: ${error instanceof Error ? error.message : String(error)}`);
    return { baseRef, changedFiles: ["**/*"] };
  }
};

/**
 * Retrieves the list of files that changed between the selected base and HEAD.
 */
export const getChangedFiles = (baseRef: string): string[] => {
  return getGitComparison(baseRef).changedFiles;
};

/**
 * Reads a repository file at a git reference without invoking a shell.
 *
 * Returns undefined when the reference exists but the file does not. Invalid
 * references and unreadable git objects throw so callers can fail safely.
 */
export const getFileAtRef = (ref: string, filePath: string): string | undefined => {
  try {
    return execFileSync("git", ["show", `${ref}:${filePath}`], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (showError) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
    } catch {
      throw new Error(`Could not resolve git reference ${ref}`, { cause: showError });
    }

    try {
      execFileSync("git", ["cat-file", "-e", `${ref}:${filePath}`], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
    } catch {
      return undefined;
    }

    throw new Error(`Could not read ${filePath} at ${ref}`, { cause: showError });
  }
};
