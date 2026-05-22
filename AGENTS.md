# Repository 指南

## 專案結構與導覽

Demonkernel 是 TypeScript Node 專案，也是一個 plugin-oriented runtime。runtime code 位於 `src/`；核心框架模組位於 `src/core`，skill plugins 位於 `src/skillPlugins`，內建 system plugins 位於 `src/systemPlugins`。測試在 `tests/` 中對應這些領域，包括 `tests/capabilities`、`tests/pluginsManager`、`tests/registry`、`tests/secrets` 與 `tests/systemPlugins`。

正式文件位於 `docs/`。更新歷史位於 `Updates/`。工具腳本位於 `tools/`，包含 logger tooling 與 UpdateLog CLI。build output 輸出到 `dist/`；runtime logs 與 conversation history 分別屬於 `logs/` 與 `history/`。不要提交 `dist/`、`logs/`、`history/`、`.env` 或產生出的 coverage。

主要架構邊界：

- `src/core/pluginsManager` 負責 plugin discovery、manifest validation、dependency-aware lifecycle orchestration、runtime status、startup reports 與 capability provider registration。
- `src/core/plugin-sdk` 定義 manifest、lifecycle、options、capability 與 plugin implementation contracts。
- `src/core/capabilities` 負責 capability definitions 與 schema validation。
- `src/core/registry` 負責 runtime capability provider lookup。
- `src/core/secrets` 是 plugin secret access 唯一支援的邊界。
- `src/core/logger` 是 `tools/logger` 的 TypeScript facade。

## ExecPlans

複雜功能、重大 refactor、高風險架構變更或多步驟維護工作，應從設計到實作都使用 ExecPlan。管理規則位於 `.agent/PLANS.md`；建立或修改任何 plan 前，先閱讀該檔案。

Active plans 應放在 `plans/active/`，並使用描述性的 `*.exec.md` 檔名。每份 ExecPlan 都必須維持自足，並持續更新 `Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 與 `Artifacts and Notes`。執行已批准的 ExecPlan 時，不要要求使用者提供下一步；直接推進到下一個 milestone，並在停止前更新 plan。

Agent reconnaissance reports 可暫存在 `.agent/reports/`，但任務結束時若需要長期保存，應歸檔到對應 ExecPlan。報告只作為導覽輔助，不是最終真相；修改 production code 前，必須直接閱讀相關 source files。

## Build、Test 與 Development Commands

專案任務使用 Yarn：

- `yarn dev` 使用 `ts-node` 執行 `src/index.ts` 作為本機開發入口。
- `yarn build` 編譯 TypeScript、用 `tsc-alias` 重寫 path aliases，並將 plugin manifests/assets 複製到 `dist/`。
- `yarn start` 先 build，再執行 `node dist/index.js`。
- `yarn test` 以 globals enabled 執行 Vitest suite。
- `yarn lint` 對整個 repository 執行 ESLint。
- `yarn updatelog:new` 建立 update log entry。
- `yarn updatelog:ensure` 檢查 staged 的非 UpdateLog 變更是否有對應 UpdateLog，並由 Husky pre-commit hook 強制執行。
- `yarn updatelog:validate:staged` 驗證 staged UpdateLog coverage 與格式。
- `yarn updatelog:validate:push` 驗證 push range 或 HEAD fallback。
- `yarn readme:sync-version` 將 `README.md` 的版本 marker 同步到最新 Main UpdateLog。
- `yarn readme:check-version` 驗證 `README.md` 的版本 marker 與最新 Main UpdateLog 一致。

## Coding Style 與 Naming Conventions

遵守 `.editorconfig`：兩空格縮排、LF line endings、UTF-8、移除 trailing whitespace，並保留 final newline。TypeScript 使用 strict mode、`NodeNext` modules、`ES2022` target，並輸出到 `dist`。適合時優先使用 `@core/*` 這類 path aliases 匯入 core 模組。

ESLint 套用於 `*.ts` 檔案，禁止 `var`，並對未使用的 TypeScript variables 發出 warning。variables/functions 使用具描述性的 camelCase，types/classes 使用 PascalCase。Plugin 與 feature directories 應遵循既有 kebab-case pattern，例如 `llm-remote-gateway` 與 `conversation-history`。Capability ids 使用 dot namespaces，例如 `system.discord.message.send`；provider methods 應使用清楚的動詞片語，例如 `sendMessage` 或 `streamChat`。

## Plugin Architecture Rules

Plugin manifests 必須使用 `runtime.startupWeight`；不要重新引入已淘汰的 `runtime.priority`。Manifest dependencies 必須使用 exact version strings。Lifecycle failure model 是 throw-only：plugin methods 失敗時應 throw，讓 `PluginsManager` 捕捉錯誤、更新 runtime state 並回報結果。

只有 system plugins 可以宣告 `capabilities.provides`。Capability execution 採 provider-first：宣告 capabilities 的 system plugin 必須實作 `getCapabilityBindings()`，並暴露 capability-specific provider methods。不要把新的 capability behavior 做成 plugin-wide `send(action)` multiplexer；`send()` 只在需要時作為相容入口或 plugin-level entry。

新增或修改 plugin 時，保持以下項目同步：

- `plugin.manifest.json`
- root `index.ts`
- `strategies/` 下的 strategy implementation
- system capabilities 對應的 `getCapabilityBindings()`
- plugin `README.md`
- 對應 `tests/` subsystem 下的 focused tests
- 行為變更時的 UpdateLog entry

目前 system plugin 職責應保持分離：`llm-remote-gateway` 處理 OpenAI-compatible remote LLM access，`discord` 處理 Discord I/O，`conversation-history` 儲存 transcript history，`talk-engine` 跨 providers 編排 conversation flow。

## README 與雙語文件同步

根目錄入口文件分為英文版 `README.md` 與繁體中文版 `README.zh-TW.md`。兩份 README 必須以雙向連結互相指向，並維持相同章節順序、相同 repository facts、相同 command lists、相同 release marker value，以及等價的維護規範。英文版不是唯一真相；中文版也不是摘要版。

任何更新只要改到 README、文件規範、UpdateLog workflow、ExecPlan workflow、專案結構、常用命令、plugin/system architecture 或 agent 行為規則，就必須同步更新兩份 README。不得只改其中一份。若某次更新判斷 README 不需調整，也必須在最終回報中明確說明已檢查且不需更新。

每份 ExecPlan 的最後一個實作動作必須是 README consistency check：確認 `README.md` 與 `README.zh-TW.md` 都已反映本次變更，兩種語言內容等價，雙向連結存在，版本 marker 一致，並執行 `yarn readme:check-version`。若自動同步工具無法涵蓋 `README.zh-TW.md`，agent 必須手動檢查中文版 marker 與內容，並在 ExecPlan 的 `Artifacts and Notes` 記錄結果。

## Testing Guidelines

Vitest 是測試框架。測試應放在對應的 `tests/<subsystem>/` 目錄。Focused unit tests 命名為 `*.test.ts`；integration coverage 使用 `*.integration.test.ts`，例如 `tests/pluginsManager` 中的既有模式。

開發時執行最小且有意義的 narrow test。例如：

- `yarn test tests/secrets` 用於 secret handling 或 plugin env-access rules。
- `yarn test tests/capabilities tests/registry` 用於 capability definition 或 provider registry changes。
- `yarn test tests/pluginsManager` 用於 plugin discovery、lifecycle、dependency 與 provider registration changes。
- `yarn test tests/systemPlugins` 用於內建 system plugin behavior。

提交 broad core、plugin-contract 或 release-bound changes 前，執行 `yarn test`。既有 external-service tests 大多使用 mocks 或 local fixtures；除非實際執行特定 e2e path，不要聲稱真實 Discord 或真實 LLM end-to-end coverage 已被覆蓋。

## UpdateLog 與 Release Notes

每次更新都必須建立或更新 UpdateLog。Agent 必須使用 `yarn updatelog:new`，或等價的 `node tools/updatelog/cli.js new`，產生更新紀錄；不得手動亂建不符合路徑規範的 UpdateLog。可再視情況使用 `yarn updatelog:validate:staged` 或 `yarn updatelog:validate:push` 驗證。Behavior changes、新增 plugins、capability contract changes、diagnostics/logging behavior changes、Discord/LLM behavior changes、secret-handling changes，以及 agent/documentation 規則變更都需要 UpdateLog。

`Updates/Main` 是全域更新索引。每一次更新，不論 Major、Minor 或 Patch，都必須反映在 `Updates/Main`。Plugin 自身有行為變更時，除了 Main 全域紀錄，也應視情況新增或更新 `Updates/Plugins/{skill|system}/...`。

新增或更新 Main UpdateLog 後，若 `README.md` 顯示版本落後於最新 Main UpdateLog，必須執行 `yarn readme:sync-version` 同步版本 marker。`package.json` 的 `version` 也是更新目標，必須與最新 Main UpdateLog 的 semantic version 對齊；現有 README sync/check 工具不會自動修改或檢查 `package.json`，agent 必須人工確認並在 ExecPlan 或 UpdateLog Notes 記錄。README 版本 marker 不應作為長期手動維護欄位；若同步工具失敗且必須手動修正，必須在 UpdateLog Notes 記錄原因。每次更新完成前，必須執行 `yarn readme:check-version`，確認 README 顯示版本與最新 Main UpdateLog 一致。

最終回報必須列出已執行的 UpdateLog validation、README version check，以及雙語 README consistency check。若因任務 ownership 或工具限制無法修改 UpdateLog、更新 README 或執行驗證，也必須在最終回報中明確說明原因。

版本號規則：

- Major (`*.0.0`)：主版本號只能由專案管理員指定與增加。Agent 不得自行提升 Major，也不得推測 Major 版本變更。
- Minor (`0.*.0`)：次版本號跟隨 ExecPlan。一份新的、被接受的 ExecPlan 代表一個新的 Minor 版本。ExecPlan 開始實作前必須綁定 Target Version，例如 `v0.16.0`。
- Patch (`0.0.*`)：修訂號跟隨同一份 ExecPlan 的後續補充任務。當 ExecPlan 的首次完整修改完成後，若又出現修正、補充、追加測試、文件補強或回歸修復，應增加 Patch，例如 `v0.16.1`。
- 多份 ExecPlan 同時存在時：新的 ExecPlan 使用當前最新 Minor 的下一個版本。舊 ExecPlan 若後續還有變動，不再取得新的 Minor，而是增加目前版本下的 Patch。`Updates/Main` 仍需依照實際更新時間記錄該次更新。

UpdateLog paths 必須遵循專案慣例，位於 `Updates/Main/...` 或 `Updates/Plugins/{skill|system}/...`。Entries 內容要具體：Summary、Changes、Impact、Tests、Risks & Rollback 與 Notes 不應使用 placeholder。

## Security、Secrets 與 Diagnostics

使用 `.env.example` 作為設定模板，真實 secrets 放在 `.env`，且不得提交。Plugins 必須透過 `@core/secrets` 讀取 secrets；不要在 plugin code 中直接讀取 `process.env`。變更 secret handling 或 environment-variable access 時，新增或更新 `tests/secrets`。

使用 repository logger，不要在 runtime 直接使用 `console.*` logging。高頻路徑與敏感 payload 預設應只記錄 summaries。完整 raw stream/content data 屬於 request-scoped diagnostics，且只能依 logger raw diagnostic rules 匯出。觸碰 diagnostics 時，保留 redaction、`requestId`、`outcome` 與 observability metadata。

## Documentation Trust Order

當來源互相衝突時，優先相信目前 machine-readable root config：`package.json`、`tsconfig.json`、`tsconfig.test.json`、`.editorconfig`、`.gitignore` 與 `eslint.config.js`。其次相信將要修改區域的 source files 與 tests。`README.md`、`README.zh-TW.md`、`docs/`、plugin READMEs、`Updates/` 與 active ExecPlan 中的 archived reconnaissance reports 適合用於導覽與理解歷史，但 implementation changes 前仍需用 source 驗證。

## Commit 與 Pull Request Guidelines

近期 commits 使用 Conventional Commit-style prefixes，例如 `feat(logger): ...` 與 `feat: ...`；延續此模式，使用簡潔的 imperative summary。保持 commits scope 明確。Pull requests 應描述變更、列出已執行的 validation commands、連結相關 issues，並在 UI、Discord behavior 或 diagnostics output 變更時附上 screenshots 或 logs。
