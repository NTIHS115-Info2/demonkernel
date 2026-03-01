"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const tar = require("tar");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function compressPreviousSessions(params) {
  const { rootDir, currentSessionName, onError } = params;
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  const targets = entries.filter(
    (entry) => entry.isDirectory() && entry.name !== currentSessionName
  );

  for (const target of targets) {
    const sourcePath = path.join(rootDir, target.name);
    const archivePath = `${sourcePath}.tar.gz`;

    try {
      if (await pathExists(archivePath)) {
        continue;
      }

      await tar.c(
        {
          gzip: true,
          file: archivePath,
          cwd: rootDir,
        },
        [target.name]
      );

      await fs.rm(sourcePath, { recursive: true, force: true });
    } catch (error) {
      if (typeof onError === "function") {
        onError(error, {
          sourcePath,
          archivePath,
        });
      }
    }
  }
}

module.exports = {
  compressPreviousSessions,
};
