"use strict";

const path = require("node:path");
const { parseVersion } = require("./version");

const MAIN_PATH_REGEX = /^Updates\/Main\/v(\d+)\/v\1\.(\d+)\/v\1\.\2\.(\d+)\.md$/;
const PLUGIN_PATH_REGEX =
  /^Updates\/Plugins\/(skill|system)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/v(\d+)\/v\3\.(\d+)\/v\3\.\4\.(\d+)\.md$/;

function normalizeToPosix(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function toRepoRelativePosix(repoRoot, absolutePath) {
  const relative = path.relative(repoRoot, absolutePath);
  return normalizeToPosix(relative);
}

function slugifyPluginName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildMainUpdatePath(version) {
  const parsed = parseVersion(version);
  if (!parsed.ok) {
    return parsed;
  }

  const { majorTag, minorTag, patchTag } = parsed.value;
  return {
    ok: true,
    value: path.join("Updates", "Main", majorTag, minorTag, `${patchTag}.md`),
  };
}

function buildPluginUpdatePath(pluginType, pluginName, version) {
  const parsed = parseVersion(version);
  if (!parsed.ok) {
    return parsed;
  }

  const safeType = String(pluginType || "").trim();
  if (safeType !== "skill" && safeType !== "system") {
    return {
      ok: false,
      error: "插件類型必須是 skill 或 system",
    };
  }

  const pluginSlug = slugifyPluginName(pluginName);
  if (!pluginSlug) {
    return {
      ok: false,
      error: "插件名稱不可為空",
    };
  }

  const { majorTag, minorTag, patchTag } = parsed.value;
  return {
    ok: true,
    value: path.join(
      "Updates",
      "Plugins",
      safeType,
      pluginSlug,
      majorTag,
      minorTag,
      `${patchTag}.md`
    ),
  };
}

function parseUpdatePath(filePath) {
  const normalized = normalizeToPosix(filePath);
  const mainMatch = MAIN_PATH_REGEX.exec(normalized);
  if (mainMatch) {
    return {
      ok: true,
      value: {
        kind: "main",
        category: "main",
        scope: "Main",
        version: `${mainMatch[1]}.${mainMatch[2]}.${mainMatch[3]}`,
      },
    };
  }

  const pluginMatch = PLUGIN_PATH_REGEX.exec(normalized);
  if (pluginMatch) {
    return {
      ok: true,
      value: {
        kind: "plugin",
        category: "plugin",
        pluginType: pluginMatch[1],
        pluginName: pluginMatch[2],
        scope: `${pluginMatch[1]}/${pluginMatch[2]}`,
        version: `${pluginMatch[3]}.${pluginMatch[4]}.${pluginMatch[5]}`,
      },
    };
  }

  return {
    ok: false,
    error: `路徑不符合 UpdateLog 規範: ${normalized}`,
  };
}

function isUpdateMarkdownPath(filePath) {
  const normalized = normalizeToPosix(filePath);
  return normalized.startsWith("Updates/") && normalized.endsWith(".md");
}

module.exports = {
  MAIN_PATH_REGEX,
  PLUGIN_PATH_REGEX,
  normalizeToPosix,
  toRepoRelativePosix,
  slugifyPluginName,
  buildMainUpdatePath,
  buildPluginUpdatePath,
  parseUpdatePath,
  isUpdateMarkdownPath,
};

