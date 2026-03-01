"use strict";

const LEVELS = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
});

const DEFAULT_LEVEL = "info";

function normalizeLevel(level, fallback = DEFAULT_LEVEL) {
  const normalized = String(level || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LEVELS, normalized)) {
    return normalized;
  }
  return fallback;
}

function isLevelEnabled(targetLevel, minimumLevel) {
  const target = normalizeLevel(targetLevel);
  const minimum = normalizeLevel(minimumLevel);
  return LEVELS[target] >= LEVELS[minimum];
}

function resolveLevelList(levels, fallback) {
  if (!Array.isArray(levels)) {
    return [...fallback];
  }
  const normalized = levels
    .map((value) => normalizeLevel(value, ""))
    .filter(Boolean);

  if (!normalized.length) {
    return [...fallback];
  }

  return [...new Set(normalized)];
}

module.exports = {
  LEVELS,
  DEFAULT_LEVEL,
  normalizeLevel,
  isLevelEnabled,
  resolveLevelList,
};
