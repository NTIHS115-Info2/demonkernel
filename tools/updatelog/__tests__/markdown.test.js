"use strict";

const { renderUpdateLog } = require("../lib/markdown");

describe("markdown", () => {
  it("renders required sections", () => {
    const markdown = renderUpdateLog({
      category: "main",
      scope: "Main",
      version: "1.0.1",
      date: "2026-02-28",
      branch: "main",
      commit: "abc1234",
      summary: ["摘要"],
      changes: {
        added: ["新增一項"],
        changed: ["調整一項"],
        fixed: ["修正一項"],
        removed: ["移除一項"],
      },
      impact: ["影響一項"],
      tests: ["測試一項"],
      risksRollback: ["風險與回滾一項"],
      notes: ["備註一項"],
    });

    expect(markdown).toContain("# UpdateLog v1.0.1");
    expect(markdown).toContain("## Metadata");
    expect(markdown).toContain("## Changes");
    expect(markdown).toContain("### Added");
    expect(markdown).toContain("## Notes");
  });
});
