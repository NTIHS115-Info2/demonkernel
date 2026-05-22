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

### 5.4 README 版本同步

README 顯示版本由最新 Main UpdateLog 決定。工具只會讀取
`Updates/Main/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md`
格式的 Main 更新紀錄，並以語意版本排序找出最新版本。

`package.json` 的 `version` 也是更新目標，應與最新 Main UpdateLog 的
semantic version 對齊。現有 `sync-readme-version` 與
`check-readme-version` 只自動處理 `README.md` marker；`package.json`
version 需由 agent 或維護者手動更新並在驗證紀錄中列明。

同步 README marker：

`node tools/updatelog/cli.js sync-readme-version`

等價 Yarn script：

`yarn readme:sync-version`

行為：

1. 讀取最新 Main UpdateLog 版本。
2. 讀取 `README.md` 的版本 marker。
3. 若 README 版本落後，僅替換 marker 中間的版本文字。
4. 印出 `previous`、`latest` 與 `changed`，方便確認是否有實際改動。
5. 不修改 `package.json`；若 Main UpdateLog 版本改變，需另行確認
   `package.json` 的 `version` 已同步。

檢查 README marker：

`node tools/updatelog/cli.js check-readme-version`

等價 Yarn script：

`yarn readme:check-version`

行為：

1. 讀取 `README.md` 的版本 marker 與最新 Main UpdateLog 版本。
2. 版本一致時 exit code 為 `0`。
3. 版本不一致、marker 缺失、marker 重複或 marker 格式錯誤時 exit code 為 `1`。
4. 失敗時印出 `readme`、`latest` 與 `error`，方便維護者修正。
5. 不檢查 `package.json`；更新完成前仍需人工確認 `package.json`
   version 與最新 Main UpdateLog 一致。

第一版不會把 README check 自動接進 `updatelog:validate:staged` 或
`updatelog:validate:push`。這兩個驗證流程目前仍只檢查 UpdateLog 檔案；
agent 或維護者需要在更新完成前另外執行 `yarn readme:check-version`。

### 5.5 README marker contract

`README.md` 必須包含唯一一組單行版本 marker：

`<!-- DEMONKERNEL_VERSION:start -->vX.Y.Z<!-- DEMONKERNEL_VERSION:end -->`

目前 README 使用的完整行格式為：

`Current release: <!-- DEMONKERNEL_VERSION:start -->vX.Y.Z<!-- DEMONKERNEL_VERSION:end -->`

契約：

1. marker 必須是唯一的；重複的 start 或 end marker 會使 sync/check 失敗。
2. marker 必須在同一行，且中間版本必須是 `vX.Y.Z`。
3. sync 只允許替換 start/end marker 中間的版本文字，不重寫 README 其他內容。
4. 若 marker 缺失、重複或格式錯誤，工具不會猜測位置，必須先修正 README marker。

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

