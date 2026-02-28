"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "..", "cli.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runGit(args, cwd) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "updatelog-test-"));
}

function initGitRepo(dir) {
  runGit(["init"], dir);
  runGit(["config", "user.email", "test@example.com"], dir);
  runGit(["config", "user.name", "Test User"], dir);
}

describe("cli", () => {
  it("creates main UpdateLog in non-interactive mode", () => {
    const dir = createTempDir();
    const result = runCli(
      [
        "new",
        "--category",
        "main",
        "--version",
        "1.0.1",
        "--summary",
        "摘要",
        "--added",
        "新增A",
        "--changed",
        "調整A",
        "--fixed",
        "修正A",
        "--removed",
        "移除A",
        "--impact",
        "影響A",
        "--tests",
        "測試A",
        "--risks",
        "風險A",
        "--notes",
        "備註A",
      ],
      dir
    );

    expect(result.status).toBe(0);
    const outputPath = path.join(dir, "Updates", "Main", "v1", "v1.0", "v1.0.1.md");
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it("fails ensure in non-interactive mode when staged has no UpdateLog", () => {
    const dir = createTempDir();
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, "file.txt"), "hello", "utf8");
    runGit(["add", "file.txt"], dir);

    const result = runCli(["ensure", "--staged"], dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("無 UpdateLog");
  });

  it("passes validate --staged with valid UpdateLog and staged code", () => {
    const dir = createTempDir();
    initGitRepo(dir);

    fs.writeFileSync(path.join(dir, "file.txt"), "hello", "utf8");
    runGit(["add", "file.txt"], dir);

    const create = runCli(
      [
        "new",
        "--category",
        "main",
        "--version",
        "1.0.2",
        "--summary",
        "摘要",
        "--added",
        "新增A",
        "--changed",
        "調整A",
        "--fixed",
        "修正A",
        "--removed",
        "移除A",
        "--impact",
        "影響A",
        "--tests",
        "測試A",
        "--risks",
        "風險A",
        "--notes",
        "備註A",
      ],
      dir
    );
    expect(create.status).toBe(0);

    runGit(["add", "Updates/Main/v1/v1.0/v1.0.2.md"], dir);

    const validate = runCli(["validate", "--staged"], dir);
    expect(validate.status).toBe(0);
  });

  it("fails validate --push when latest commit has code change but no UpdateLog", () => {
    const dir = createTempDir();
    initGitRepo(dir);

    fs.writeFileSync(path.join(dir, "base.txt"), "base", "utf8");
    runGit(["add", "base.txt"], dir);
    runGit(["commit", "-m", "base"], dir);

    fs.writeFileSync(path.join(dir, "code.txt"), "change", "utf8");
    runGit(["add", "code.txt"], dir);
    runGit(["commit", "-m", "code only"], dir);

    const validate = runCli(["validate", "--push"], dir);
    expect(validate.status).toBe(1);
    expect(validate.stderr).toContain("未包含任何 UpdateLog");
  });
});
