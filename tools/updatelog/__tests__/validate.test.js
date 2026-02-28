"use strict";

const { validateUpdateFileContent } = require("../lib/validate");

describe("validate", () => {
  it("accepts valid content", () => {
    const content = `# UpdateLog v1.0.1

## Metadata
- Category: main
- Scope: Main
- Version: 1.0.1
- Date: 2026-02-28
- Branch: main
- Commit: abc1234

## Summary
- 完成主流程

## Changes
### Added
- 新增一項

### Changed
- 調整一項

### Fixed
- 修正一項

### Removed
- 移除一項

## Impact
- API 介面穩定

## Tests
- 單元測試通過

## Risks & Rollback
- 可回滾到前版

## Notes
- 無
`;
    const result = validateUpdateFileContent(
      "Updates/Main/v1/v1.0/v1.0.1.md",
      content
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing section", () => {
    const content = `# UpdateLog v1.0.1

## Metadata
- Category: main
- Scope: Main
- Version: 1.0.1
- Date: 2026-02-28
- Branch: main
- Commit: abc1234
`;
    const result = validateUpdateFileContent(
      "Updates/Main/v1/v1.0/v1.0.1.md",
      content
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("缺少必要段落");
  });

  it("rejects category mismatch", () => {
    const content = `# UpdateLog v1.0.1

## Metadata
- Category: plugin
- Scope: Main
- Version: 1.0.1
- Date: 2026-02-28
- Branch: main
- Commit: abc1234

## Summary
- 完成主流程

## Changes
### Added
- 新增一項

### Changed
- 調整一項

### Fixed
- 修正一項

### Removed
- 移除一項

## Impact
- API 介面穩定

## Tests
- 單元測試通過

## Risks & Rollback
- 可回滾到前版

## Notes
- 無
`;
    const result = validateUpdateFileContent(
      "Updates/Main/v1/v1.0/v1.0.1.md",
      content
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("路徑分類與 Metadata Category 不一致");
  });
});
