"use strict";

const { execFileSync } = require("node:child_process");

function runGit(args, options = {}) {
  try {
    const output = execFileSync("git", args, {
      cwd: options.cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      ok: true,
      value: output.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.stderr
          ? String(error.stderr).trim()
          : error && error.message
          ? String(error.message)
          : "git command failed",
    };
  }
}

function getCurrentBranch(cwd) {
  const result = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  if (!result.ok) return "unknown";
  return result.value || "unknown";
}

function getShortCommit(cwd) {
  const result = runGit(["rev-parse", "--short", "HEAD"], { cwd });
  if (!result.ok) return "unknown";
  return result.value || "unknown";
}

function getStagedFiles(cwd) {
  const result = runGit(
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd }
  );
  if (!result.ok || !result.value) return [];
  return result.value.split(/\r?\n/).filter(Boolean);
}

function stageFile(filePath, cwd) {
  return runGit(["add", "--", filePath], { cwd });
}

function getUpstreamRange(cwd) {
  const upstream = runGit(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { cwd }
  );

  if (!upstream.ok || !upstream.value) {
    return {
      ok: false,
      error: "找不到 upstream，將改用 HEAD 單提交檢查",
    };
  }

  return {
    ok: true,
    value: `${upstream.value}..HEAD`,
  };
}

function getChangedFilesInRange(range, cwd) {
  if (!range) {
    const fallback = runGit(["show", "--pretty=", "--name-only", "HEAD"], {
      cwd,
    });
    if (!fallback.ok || !fallback.value) return [];
    return fallback.value.split(/\r?\n/).filter(Boolean);
  }

  const result = runGit(
    ["diff", "--name-only", "--diff-filter=ACMR", range],
    { cwd }
  );
  if (!result.ok || !result.value) return [];
  return result.value.split(/\r?\n/).filter(Boolean);
}

function isGitRepo(cwd) {
  const result = runGit(["rev-parse", "--is-inside-work-tree"], { cwd });
  return result.ok && result.value === "true";
}

module.exports = {
  runGit,
  getCurrentBranch,
  getShortCommit,
  getStagedFiles,
  stageFile,
  getUpstreamRange,
  getChangedFilesInRange,
  isGitRepo,
};

