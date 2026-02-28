"use strict";

const STRICT_SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function isStrictSemver(version) {
  return STRICT_SEMVER_REGEX.test(String(version || "").trim());
}

function parseVersion(version) {
  const raw = String(version || "").trim();
  const match = STRICT_SEMVER_REGEX.exec(raw);

  if (!match) {
    return {
      ok: false,
      error: "版本必須為 x.y.z 且每段皆為數字，例如 1.0.1",
    };
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  return {
    ok: true,
    value: {
      raw,
      major,
      minor,
      patch,
      majorTag: `v${major}`,
      minorTag: `v${major}.${minor}`,
      patchTag: `v${major}.${minor}.${patch}`,
    },
  };
}

module.exports = {
  STRICT_SEMVER_REGEX,
  isStrictSemver,
  parseVersion,
};

