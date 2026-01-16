import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as core from "@actions/core";
import { quote } from "shell-quote";
import type { GitHubEventPullRequest } from "../types/index.js";

/**
 * Determines the appropriate git reference to use as the base for comparison.
 *
 * The base reference selection strategy:
 * - For pull requests: Uses the base branch SHA from the PR event
 * - For pushes: Uses the previous commit (HEAD~1)
 * - Falls back to 'main' branch if event parsing fails
 */
export function getBaseRef(): string {
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
}

/**
 * Retrieves the list of files that have changed between the base reference and HEAD.
 *
 * Uses multiple git diff strategies to ensure robust file detection:
 * 1. git diff --name-only baseRef...HEAD (preferred for PRs)
 * 2. git diff --name-only baseRef HEAD (fallback)
 * 3. git diff --name-only HEAD~1 HEAD (last resort)
 */
export function getChangedFiles(baseRef: string): string[] {
  try {
    // Sanitize baseRef to prevent command injection
    const safeBaseRef = quote([baseRef]);

    // Try different git diff approaches
    const commands = [
      `git diff --name-only ${safeBaseRef}...HEAD`,
      `git diff --name-only ${safeBaseRef} HEAD`,
      "git diff --name-only HEAD~1 HEAD",
    ];

    for (const cmd of commands) {
      try {
        const output = execSync(cmd, {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        });
        const files = output.split("\n").filter((file) => file.trim());
        if (files.length > 0) {
          return files;
        }
      } catch {
        // continue to next command
      }
    }

    core.warning("⚠️ Could not determine changed files, assuming all apps may be affected");
    return ["**/*"];
  } catch (error) {
    core.warning(`⚠️ Git diff failed: ${error instanceof Error ? error.message : String(error)}`);
    return ["**/*"];
  }
}
