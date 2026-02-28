"use strict";

function bulletLines(items) {
  const values = Array.isArray(items)
    ? items
    : String(items || "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);

  if (!values.length) {
    return "- 無";
  }

  return values.map((item) => `- ${item}`).join("\n");
}

function renderUpdateLog(payload) {
  return [
    `# UpdateLog v${payload.version}`,
    "",
    "## Metadata",
    `- Category: ${payload.category}`,
    `- Scope: ${payload.scope}`,
    `- Version: ${payload.version}`,
    `- Date: ${payload.date}`,
    `- Branch: ${payload.branch}`,
    `- Commit: ${payload.commit}`,
    "",
    "## Summary",
    bulletLines(payload.summary),
    "",
    "## Changes",
    "### Added",
    bulletLines(payload.changes.added),
    "",
    "### Changed",
    bulletLines(payload.changes.changed),
    "",
    "### Fixed",
    bulletLines(payload.changes.fixed),
    "",
    "### Removed",
    bulletLines(payload.changes.removed),
    "",
    "## Impact",
    bulletLines(payload.impact),
    "",
    "## Tests",
    bulletLines(payload.tests),
    "",
    "## Risks & Rollback",
    bulletLines(payload.risksRollback),
    "",
    "## Notes",
    bulletLines(payload.notes),
    "",
  ].join("\n");
}

module.exports = {
  renderUpdateLog,
};

