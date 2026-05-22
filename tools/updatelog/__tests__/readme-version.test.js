"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  findLatestMainUpdateVersion,
  syncReadmeVersion,
  checkReadmeVersion,
} = require("../lib/readme-version");

const MARKER_START = "<!-- DEMONKERNEL_VERSION:start -->";
const MARKER_END = "<!-- DEMONKERNEL_VERSION:end -->";

function createTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "readme-version-test-"));
}

function writeFile(repoRoot, relativePath, content = "") {
  const filePath = path.join(repoRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeReadme(repoRoot, version) {
  writeFile(
    repoRoot,
    "README.md",
    `# Test Repo\n\nCurrent release: ${MARKER_START}${version}${MARKER_END}\n`
  );
}

function writeMainUpdate(repoRoot, version) {
  const [major, minor] = version.split(".");
  writeFile(
    repoRoot,
    `Updates/Main/v${major}/v${major}.${minor}/v${version}.md`,
    `# UpdateLog v${version}\n`
  );
}

describe("readme-version", () => {
  it("finds the maximum semantic Main UpdateLog version and ignores invalid paths", () => {
    const repoRoot = createTempRepo();
    writeMainUpdate(repoRoot, "1.2.3");
    writeMainUpdate(repoRoot, "1.10.0");
    writeMainUpdate(repoRoot, "1.9.99");
    writeFile(repoRoot, "Updates/Main/v99/v99.0/v98.0.0.md");
    writeFile(repoRoot, "Updates/Main/v9/v9.9/not-a-version.md");
    writeFile(repoRoot, "Updates/Main/v2/v2.0/v2.0.0.txt");

    expect(findLatestMainUpdateVersion(repoRoot)).toBe("v1.10.0");
  });

  it("syncs the README marker from an old version to the latest version", () => {
    const repoRoot = createTempRepo();
    writeReadme(repoRoot, "v0.1.0");
    writeMainUpdate(repoRoot, "0.1.0");
    writeMainUpdate(repoRoot, "0.2.0");

    const result = syncReadmeVersion(repoRoot);
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    expect(result).toEqual({
      previousVersion: "v0.1.0",
      nextVersion: "v0.2.0",
      changed: true,
    });
    expect(readme).toContain(`${MARKER_START}v0.2.0${MARKER_END}`);
  });

  it("returns changed false when rerunning sync and leaves README content untouched", () => {
    const repoRoot = createTempRepo();
    writeReadme(repoRoot, "v0.2.0");
    writeMainUpdate(repoRoot, "0.2.0");
    const before = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    const result = syncReadmeVersion(repoRoot);
    const after = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    expect(result).toEqual({
      previousVersion: "v0.2.0",
      nextVersion: "v0.2.0",
      changed: false,
    });
    expect(after).toBe(before);
  });

  it("fails check clearly when the README marker is missing", () => {
    const repoRoot = createTempRepo();
    writeFile(repoRoot, "README.md", "# Test Repo\n");
    writeMainUpdate(repoRoot, "0.2.0");

    const result = checkReadmeVersion(repoRoot);

    expect(result.ok).toBe(false);
    expect(result.readmeVersion).toBeNull();
    expect(result.latestVersion).toBe("v0.2.0");
    expect(result.error).toContain("marker is missing");
  });

  it("fails check clearly when the README marker is duplicated", () => {
    const repoRoot = createTempRepo();
    writeFile(
      repoRoot,
      "README.md",
      [
        `Current release: ${MARKER_START}v0.2.0${MARKER_END}`,
        `Previous release: ${MARKER_START}v0.1.0${MARKER_END}`,
      ].join("\n")
    );
    writeMainUpdate(repoRoot, "0.2.0");

    const result = checkReadmeVersion(repoRoot);

    expect(result.ok).toBe(false);
    expect(result.readmeVersion).toBeNull();
    expect(result.latestVersion).toBe("v0.2.0");
    expect(result.error).toContain("marker is duplicated");
  });

  it("fails check clearly when the README version lags behind the latest UpdateLog", () => {
    const repoRoot = createTempRepo();
    writeReadme(repoRoot, "v0.1.0");
    writeMainUpdate(repoRoot, "0.1.0");
    writeMainUpdate(repoRoot, "0.2.0");

    const result = checkReadmeVersion(repoRoot);

    expect(result).toEqual({
      ok: false,
      readmeVersion: "v0.1.0",
      latestVersion: "v0.2.0",
      error:
        "README version v0.1.0 does not match latest Main UpdateLog version v0.2.0",
    });
  });
});
