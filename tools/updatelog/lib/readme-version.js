"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  parseUpdatePath,
  toRepoRelativePosix,
} = require("./path");
const { parseVersion } = require("./version");

const README_VERSION_START = "<!-- DEMONKERNEL_VERSION:start -->";
const README_VERSION_END = "<!-- DEMONKERNEL_VERSION:end -->";
const README_VERSION_REGEX = new RegExp(
  `${escapeRegex(README_VERSION_START)}(v\\d+\\.\\d+\\.\\d+)${escapeRegex(
    README_VERSION_END
  )}`,
  "g"
);
const README_VERSION_MARKER_EXAMPLE = `${README_VERSION_START}vX.Y.Z${README_VERSION_END}`;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getReadmePath(repoRoot) {
  return path.join(repoRoot, "README.md");
}

function countOccurrences(content, needle) {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while (index !== -1) {
    index = content.indexOf(needle, index);
    if (index !== -1) {
      count += 1;
      index += needle.length;
    }
  }

  return count;
}

function readMarkdownFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function compareParsedVersions(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function parseReadmeMarker(content) {
  const startCount = countOccurrences(content, README_VERSION_START);
  const endCount = countOccurrences(content, README_VERSION_END);

  if (startCount === 0 && endCount === 0) {
    throw new Error(
      `README version marker is missing; expected ${README_VERSION_MARKER_EXAMPLE}`
    );
  }

  if (startCount > 1 || endCount > 1) {
    throw new Error(
      `README version marker is duplicated; expected exactly one ${README_VERSION_MARKER_EXAMPLE}`
    );
  }

  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `README version marker is malformed; expected ${README_VERSION_MARKER_EXAMPLE}`
    );
  }

  README_VERSION_REGEX.lastIndex = 0;
  const matches = [...content.matchAll(README_VERSION_REGEX)];

  if (matches.length === 0) {
    throw new Error(
      `README version marker is malformed; expected single-line ${README_VERSION_MARKER_EXAMPLE}`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `README version marker is duplicated; expected exactly one ${README_VERSION_MARKER_EXAMPLE}`
    );
  }

  return {
    marker: matches[0][0],
    version: matches[0][1],
  };
}

function findLatestMainUpdateVersion(repoRoot) {
  const mainRoot = path.join(repoRoot, "Updates", "Main");
  const versions = [];

  for (const filePath of readMarkdownFiles(mainRoot)) {
    const relativePath = toRepoRelativePosix(repoRoot, filePath);
    const parsedPath = parseUpdatePath(relativePath);
    if (!parsedPath.ok || parsedPath.value.kind !== "main") {
      continue;
    }

    const parsedVersion = parseVersion(parsedPath.value.version);
    if (!parsedVersion.ok) {
      continue;
    }

    versions.push(parsedVersion.value);
  }

  if (versions.length === 0) {
    throw new Error(
      "No valid Main UpdateLog versions found under Updates/Main"
    );
  }

  versions.sort(compareParsedVersions);
  return `v${versions[versions.length - 1].raw}`;
}

function readReadmeVersion(repoRoot) {
  const readmePath = getReadmePath(repoRoot);
  const content = fs.readFileSync(readmePath, "utf8");
  return parseReadmeMarker(content).version;
}

function syncReadmeVersion(repoRoot) {
  const readmePath = getReadmePath(repoRoot);
  const content = fs.readFileSync(readmePath, "utf8");
  const marker = parseReadmeMarker(content);
  const nextVersion = findLatestMainUpdateVersion(repoRoot);

  if (marker.version === nextVersion) {
    return {
      previousVersion: marker.version,
      nextVersion,
      changed: false,
    };
  }

  const nextMarker = `${README_VERSION_START}${nextVersion}${README_VERSION_END}`;
  fs.writeFileSync(readmePath, content.replace(marker.marker, nextMarker));

  return {
    previousVersion: marker.version,
    nextVersion,
    changed: true,
  };
}

function checkReadmeVersion(repoRoot) {
  const latestVersion = findLatestMainUpdateVersion(repoRoot);

  try {
    const readmeVersion = readReadmeVersion(repoRoot);
    if (readmeVersion !== latestVersion) {
      return {
        ok: false,
        readmeVersion,
        latestVersion,
        error: `README version ${readmeVersion} does not match latest Main UpdateLog version ${latestVersion}`,
      };
    }

    return {
      ok: true,
      readmeVersion,
      latestVersion,
    };
  } catch (error) {
    return {
      ok: false,
      readmeVersion: null,
      latestVersion,
      error: error.message,
    };
  }
}

module.exports = {
  findLatestMainUpdateVersion,
  readReadmeVersion,
  syncReadmeVersion,
  checkReadmeVersion,
};
