# UpdateLog 規範與工具說明

本文件定義 Demonkernel 的 UpdateLog 撰寫格式、目錄規範與 CLI / Git Hook 使用方式。

## 1. 目標

1. 每次提交與推送都能追溯變更內容。
2. Main 與插件更新遵循一致結構。
3. 以工具強制規範，而非手動約定。

## 2. 檔案結構規範

### 2.1 Main

`Updates/Main/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md`

範例：
`Updates/Main/v1/v1.0/v1.0.1.md`

### 2.2 Plugin

`Updates/Plugins/{skill|system}/{plugin-name}/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md`

範例：
`Updates/Plugins/skill/example/v1/v1.0/v1.0.1.md`

## 3. 版本格式

僅接受嚴格 `x.y.z`（三段整數）：

- 合法：`1.0.1`
- 不合法：`1.0`、`v1.0.1`、`1.0.1-beta.1`

## 4. Markdown 結構

每個 UpdateLog 必須包含以下章節：

1. `# UpdateLog vX.Y.Z`
2. `## Metadata`
3. `## Summary`
4. `## Changes`
5. `## Impact`
6. `## Tests`
7. `## Risks & Rollback`
8. `## Notes`

`## Metadata` 固定欄位：

- `Category`
- `Scope`
- `Version`
- `Date`
- `Branch`
- `Commit`

`## Changes` 固定子章節：

- `### Added`
- `### Changed`
- `### Fixed`
- `### Removed`

## 5. CLI

工具入口：

`node tools/updatelog/cli.js`

### 5.1 建立 UpdateLog

`node tools/updatelog/cli.js new`

可帶參數：

- `--category main|plugin`
- `--plugin-type skill|system`
- `--plugin-name <name>`
- `--version <x.y.z>`
- `--force`
- `--summary "..."`
- `--added "a;b"`
- `--changed "a;b"`
- `--fixed "a;b"`
- `--removed "a;b"`
- `--impact "a;b"`
- `--tests "a;b"`
- `--risks "a;b"`
- `--notes "a;b"`

### 5.2 pre-commit 保證

`node tools/updatelog/cli.js ensure --staged`

行為：

1. 若 staged 僅含 Updates 變更，直接通過。
2. 若 staged 有非 Updates 變更且已有合規 UpdateLog，通過。
3. 若缺少 UpdateLog：
   - 互動模式：啟動問答並自動 `git add`。
   - 非互動模式：直接失敗。

### 5.3 驗證

- staged 驗證：`node tools/updatelog/cli.js validate --staged`
- push 驗證：`node tools/updatelog/cli.js validate --push`

## 6. 驗證規則

1. 路徑需符合 Main 或 Plugin 規範。
2. 檔名版本與 Metadata 版本一致。
3. 標題版本與 Metadata 版本一致。
4. `Category`、`Scope` 必須與路徑一致。
5. `Commit` 需為短 SHA（7~12）或 `unknown`。
6. 必填章節不得缺少。
7. 必填章節內容不可為空或占位文字（例如 `待補` / `TBD` / `TODO`）。

## 7. 模板集

模板位於：

- `tools/updatelog/templates/registry.json`
- `tools/updatelog/templates/main.json`
- `tools/updatelog/templates/plugin.json`

欄位最小契約：

- `id`
- `category`
- `questions[]`
- `sections[]`
- `requiredSections[]`

