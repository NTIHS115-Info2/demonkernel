"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseVersion } = require("./version");
const { parseUpdatePath, toRepoRelativePosix, normalizeToPosix } = require("./path");

const REQUIRED_SECTIONS = [
  "# UpdateLog",
  "## Metadata",
  "## Summary",
  "## Changes",
  "## Impact",
  "## Tests",
  "## Risks & Rollback",
  "## Notes",
];

const REQUIRED_CHANGE_SUBSECTIONS = [
  "### Added",
  "### Changed",
  "### Fixed",
  "### Removed",
];

const PLACEHOLDER_PATTERNS = [/^\s*-\s*待補\s*$/i, /^\s*-\s*TBD\s*$/i, /^\s*-\s*TODO\s*$/i];

function validateUpdateFileContent(filePath, content, repoRoot) {
  const errors = [];
  const normalizedContent = String(content || "").replace(/\r\n/g, "\n");
  const normalizedPath = repoRoot
    ? toRepoRelativePosix(repoRoot, filePath)
    : normalizeToPosix(filePath);

  const parsedPath = parseUpdatePath(normalizedPath);
  if (!parsedPath.ok) {
    errors.push(parsedPath.error);
    return { ok: false, errors };
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!normalizedContent.includes(heading)) {
      errors.push(`缺少必要段落: ${heading}`);
    }
  }

  for (const heading of REQUIRED_CHANGE_SUBSECTIONS) {
    if (!normalizedContent.includes(heading)) {
      errors.push(`缺少 Changes 子段落: ${heading}`);
    }
  }

  const versionFromTitle = matchOne(
    normalizedContent,
    /^# UpdateLog v(\d+\.\d+\.\d+)\s*$/m
  );
  const versionFromMeta = matchOne(
    normalizedContent,
    /^- Version:\s*(\d+\.\d+\.\d+)\s*$/m
  );
  const categoryFromMeta = matchOne(
    normalizedContent,
    /^- Category:\s*(main|plugin)\s*$/m
  );
  const scopeFromMeta = matchOne(normalizedContent, /^- Scope:\s*(.+)\s*$/m);
  const commitFromMeta = matchOne(
    normalizedContent,
    /^- Commit:\s*([a-f0-9]{7,12}|unknown)\s*$/m
  );

  if (!versionFromTitle) {
    errors.push("標題版本格式錯誤，需為 # UpdateLog vX.Y.Z");
  } else {
    const p = parseVersion(versionFromTitle);
    if (!p.ok) errors.push("標題版本不是嚴格 x.y.z 格式");
  }

  if (!versionFromMeta) {
    errors.push("Metadata Version 格式錯誤，需為 x.y.z");
  }

  if (!categoryFromMeta) {
    errors.push("Metadata Category 必須是 main 或 plugin");
  }

  if (!scopeFromMeta) {
    errors.push("Metadata Scope 不能為空");
  }

  if (!commitFromMeta) {
    errors.push("Metadata Commit 必須是 7~12 碼短 SHA（或 unknown）");
  }

  if (versionFromTitle && versionFromMeta && versionFromTitle !== versionFromMeta) {
    errors.push("標題版本與 Metadata Version 不一致");
  }

  if (versionFromMeta && versionFromMeta !== parsedPath.value.version) {
    errors.push("檔名版本與 Metadata Version 不一致");
  }

  if (categoryFromMeta && categoryFromMeta !== parsedPath.value.category) {
    errors.push("路徑分類與 Metadata Category 不一致");
  }

  if (scopeFromMeta && scopeFromMeta !== parsedPath.value.scope) {
    errors.push("路徑範圍與 Metadata Scope 不一致");
  }

  for (const sectionHeading of [
    "## Summary",
    "## Impact",
    "## Tests",
    "## Risks & Rollback",
    "## Notes",
  ]) {
    const section = extractSection(normalizedContent, sectionHeading);
    if (!hasNonEmptyBullet(section)) {
      errors.push(`${sectionHeading} 內容不可為空`);
    }
    if (hasPlaceholderBullet(section)) {
      errors.push(`${sectionHeading} 不可使用占位內容（如 待補/TBD/TODO）`);
    }
  }

  const changes = extractSection(normalizedContent, "## Changes");
  for (const changeHeading of REQUIRED_CHANGE_SUBSECTIONS) {
    const subsection = extractSubsection(changes, changeHeading);
    if (!hasNonEmptyBullet(subsection)) {
      errors.push(`${changeHeading} 內容不可為空`);
    }
    if (hasPlaceholderBullet(subsection)) {
      errors.push(`${changeHeading} 不可使用占位內容（如 待補/TBD/TODO）`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateUpdateFileOnDisk(filePath, repoRoot) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(repoRoot || process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      errors: [`檔案不存在: ${absolutePath}`],
    };
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  return validateUpdateFileContent(absolutePath, content, repoRoot || process.cwd());
}

function validateUpdateFiles(filePaths, repoRoot) {
  const details = [];
  for (const filePath of filePaths) {
    const result = validateUpdateFileOnDisk(filePath, repoRoot);
    details.push({
      filePath,
      ...result,
    });
  }

  const errors = details
    .filter((item) => !item.ok)
    .map((item) => ({ filePath: item.filePath, errors: item.errors }));

  return {
    ok: errors.length === 0,
    errors,
    details,
  };
}

function extractSection(markdown, heading) {
  const escaped = escapeRegExp(heading);
  const regex = new RegExp(
    `${escaped}\\n([\\s\\S]*?)(?=\\n## |\\n# [^#]|$)`
  );
  const match = regex.exec(markdown);
  return match ? match[1].trim() : "";
}

function extractSubsection(markdown, heading) {
  const escaped = escapeRegExp(heading);
  const regex = new RegExp(
    `${escaped}\\n([\\s\\S]*?)(?=\\n### |\\n## |\\n# [^#]|$)`
  );
  const match = regex.exec(markdown);
  return match ? match[1].trim() : "";
}

function hasNonEmptyBullet(sectionText) {
  const lines = String(sectionText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.some((line) => /^-\s+\S+/.test(line));
}

function hasPlaceholderBullet(sectionText) {
  const lines = String(sectionText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.some((line) => PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(line)));
}

function matchOne(text, regex) {
  const match = regex.exec(text);
  return match ? String(match[1]).trim() : "";
}

function escapeRegExp(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  REQUIRED_SECTIONS,
  REQUIRED_CHANGE_SUBSECTIONS,
  validateUpdateFileContent,
  validateUpdateFileOnDisk,
  validateUpdateFiles,
};
