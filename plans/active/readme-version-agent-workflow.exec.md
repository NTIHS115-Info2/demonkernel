# README 版本同步與 Agent 更新流程規範

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained according to `.agent/PLANS.md`.

Target Version: v0.18.0

## Purpose / Big Picture

本計畫要讓 Demonkernel 的專案入口文件、版本顯示、UpdateLog 與 agent 更新規範形成一套一致的維護流程。完成後，維護者或 agent 可以從根目錄 `README.md` 快速理解專案定位、核心架構與常用指令；README 顯示的版本會由工具從 `Updates/Main` 最新紀錄同步，而不是靠人工長期手改；`AGENTS.md` 會明確規定每次更新後如何建立 UpdateLog、何時同步 README、哪些驗證命令必須執行。

這不是單純補一份 README。真正目標是建立「README、版本號、UpdateLog、Agent 規範」之間的可驗證工作流，避免未來 agent 只修改 code，卻忘記同步文件、版本與更新紀錄。

v0.18.1 patch 追加雙語入口文件要求：根目錄同時維護英文版 `README.md` 與繁體中文版 `README.zh-TW.md`。兩份 README 必須互相連結，並維持相同章節順序、相同 facts、相同 commands、相同 release marker value 與等價維護規範。每份 ExecPlan 的最後一個實作動作必須是 README consistency check。

v0.18.2 patch 依使用者回饋重寫 README：README 應是給人看的專案門面，而不是另一份 agent 操作規範。兩份 README 改為說明 Demonkernel 的專案目的、預設 conversation stack、plugin/capability runtime 運作方式、內建元件、快速開始、設定與專案結構；agent-specific rules 保留在 `AGENTS.md` 與 `.agent/PLANS.md`。本 patch 也確認 `package.json` 的 `version` 是版本同步目標之一，應與最新 Main UpdateLog 的 semantic version 對齊；目前工具只自動同步 README marker，`package.json` 由 agent 手動更新並在驗證證據中記錄。

## Progress

- [x] (2026-05-20 11:55 Asia/Taipei) 已整理需求：本次工作要補 README、建立 README 版本同步腳本、整合 UpdateLog workflow、補強 agent 更新規範。
- [x] (2026-05-20 11:55 Asia/Taipei) 已確認現況：`README.md` 是空檔，`package.json` 版本是 `0.15.2`，最新 Main UpdateLog 是 `v0.17.3`。
- [x] (2026-05-20 11:55 Asia/Taipei) 已拆解 milestone，並決定本 ExecPlan 使用 Target Version `v0.18.0`。
- [x] (2026-05-22 Asia/Taipei) 已補完整根目錄 `README.md`，包含專案定位、固定 release marker、核心架構、內建 system plugins、常用 Yarn commands、UpdateLog workflow、ExecPlan usage、agent maintenance notes 與 documentation trust order。
- [x] (2026-05-22 Asia/Taipei) 已建立 `tools/updatelog/lib/readme-version.js`，提供 `findLatestMainUpdateVersion`、`readReadmeVersion`、`syncReadmeVersion` 與 `checkReadmeVersion` 四個 CommonJS helper。
- [x] (2026-05-22 Asia/Taipei) 已完成 Milestone 4：`tools/updatelog/cli.js` 新增 `sync-readme-version` 與 `check-readme-version` 子命令，`package.json` 新增 `readme:sync-version` 與 `readme:check-version` scripts，`docs/updatelog-spec.md` 補上 command 與 marker contract；依 Milestone 4 規格尚未接入 `updatelog:validate:*`。
- [x] (2026-05-22 Asia/Taipei) 已完成 Milestone 5：`AGENTS.md` 的 UpdateLog 與 Release Notes 區域已加入 README version sync/check、UpdateLog tool usage、manual marker fallback Notes 與 final report validation 規則。
- [x] (2026-05-22 19:29 Asia/Taipei) 已完成 Milestone 6：新增 `tools/updatelog/__tests__/readme-version.test.js`，使用 temp directory fixtures 覆蓋 latest Main UpdateLog version scan、README sync、idempotent sync、missing marker、duplicate marker 與 lagging version check failure。
- [x] (2026-05-22 19:29 Asia/Taipei) 已執行 `yarn test tools/updatelog`，6 個 test files、20 個 tests 全部通過；既有 UpdateLog validate tests 未被破壞。
- [x] (2026-05-22 19:30 Asia/Taipei) 已執行 `yarn readme:sync-version`、`yarn readme:check-version`、`yarn updatelog:validate:staged` 與 `yarn lint`；README sync/check 與 UpdateLog staged validation 皆通過，lint 無 error 且保留 1 個既有 warning。
- [x] (2026-05-22 19:34 Asia/Taipei) 已更新 `Updates/Main/v0/v0.18/v0.18.0.md`，反映 README version workflow 的完成實作與 Milestone 6 validation evidence。
- [x] (2026-05-22 20:05 Asia/Taipei) 已建立 `Updates/Main/v0/v0.18/v0.18.1.md`，作為本 ExecPlan 的 patch UpdateLog，記錄中文版 README 與雙語一致性規範。
- [x] (2026-05-22 20:05 Asia/Taipei) 已執行 `yarn readme:sync-version`，將 `README.md` release marker 從 `v0.18.0` 同步到最新 Main UpdateLog `v0.18.1`。
- [x] (2026-05-22 20:05 Asia/Taipei) 已新增 `README.zh-TW.md`，並在 `README.md` 與 `README.zh-TW.md` 之間加入雙向語言連結。
- [x] (2026-05-22 20:05 Asia/Taipei) 已更新 `AGENTS.md`，嚴格要求雙語 README 同步、最終回報列出雙語 consistency check，以及每份 ExecPlan 最後一個實作動作必須確認雙語 README 等價。
- [x] (2026-05-22 20:05 Asia/Taipei) 已更新 `.agent/PLANS.md` 的不可協商要求、README 雙語同步規則、ExecPlan 骨架與 acceptance 範例，要求每份 ExecPlan 最後一個實作步驟是 README consistency check。
- [x] (2026-05-22 20:10 Asia/Taipei) 已完成本 patch 的最後實作動作：README consistency check。`README.md` 與 `README.zh-TW.md` 互相連結，章節順序對應，release marker 皆為 `v0.18.1`，且 `yarn readme:check-version` 通過。
- [x] (2026-05-22 20:24 Asia/Taipei) 已建立 `Updates/Main/v0/v0.18/v0.18.2.md`，記錄 README 重寫為人類導向專案門面的 patch。
- [x] (2026-05-22 20:24 Asia/Taipei) 已執行 `yarn readme:sync-version`，將 `README.md` release marker 從 `v0.18.1` 同步到最新 Main UpdateLog `v0.18.2`。
- [x] (2026-05-22 20:24 Asia/Taipei) 已重寫 `README.md` 與 `README.zh-TW.md`，讓 README 聚焦專案介紹、conversation stack、runtime 架構、built-in components、quick start、configuration、project structure 與 documentation/release 指引。
- [x] (2026-05-22 20:28 Asia/Taipei) 已執行 `yarn readme:check-version` 與 `yarn updatelog:validate:staged`，兩者皆通過；`Updates/Main/v0/v0.18/v0.18.2.md` 已更新實際驗證結果。
- [x] (2026-05-22 22:50 Asia/Taipei) 已依 review 修正版本同步決策：`package.json` 的 `version` 是更新目標，現況 `0.18.2` 應與最新 Main UpdateLog `v0.18.2` 對齊；README sync 工具仍只自動修改 README marker。
- [x] (2026-05-22 22:50 Asia/Taipei) 已補強 v0.18.2 UpdateLog 的 Tests/Notes，明確列出雙語 README consistency check 檢查了雙向連結、章節順序、repository facts、command lists、release marker、維護規範入口與 `package.json` version。
- [x] (2026-05-22 Asia/Taipei) 已使用 repository UpdateLog CLI 建立 `Updates/Main/v0/v0.18/v0.18.0.md`，記錄 README / version sync / agent workflow 的規劃與後續實作。
- [x] (2026-05-22 Asia/Taipei) 已使用 repository UpdateLog validation library 直接驗證 `Updates/Main/v0/v0.18/v0.18.0.md` 格式通過。
- [x] (2026-05-22 Asia/Taipei) 已更新本 ExecPlan 的 Milestone 1 living sections，包含 `Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 與 `Artifacts and Notes`。
- [x] (2026-05-22 Asia/Taipei) 已依 Milestone 2 ownership 只修改 `README.md` 與本 ExecPlan living sections；未修改 tool scripts、`AGENTS.md`、docs、`package.json`、tests 或 UpdateLog。
- [x] (2026-05-22 Asia/Taipei) 已驗證 README release marker 位於 `README.md:3`，並檢查 worktree status 以確認本 milestone 未擴大修改範圍。

## Surprises & Discoveries

- Observation: `README.md` 目前是 0 bytes，不能作為 repository 入口。
  Evidence: 在 repository root 執行 `wc -c README.md` 回傳 `0 README.md`。

- Observation: 版本來源目前不一致，`package.json` 仍是 `0.15.2`，但最新 Main UpdateLog 已經是 `v0.17.3`。
  Evidence: `package.json` 的 `version` 欄位是 `0.15.2`；`Updates/Main/v0/v0.17/v0.17.3.md` 存在且 Metadata Version 是 `0.17.3`。

- Observation: 既有 UpdateLog CLI 已有建立、ensure 與 validate 流程，適合延伸 README version check，而不是另建一套完全獨立的 release 工具。
  Evidence: `package.json` 已提供 `yarn updatelog:new`、`yarn updatelog:ensure`、`yarn updatelog:validate:staged` 與 `yarn updatelog:validate:push`。

- Observation: Milestone 1 開始前尚未存在 `Updates/Main/v0/v0.18` 目錄；v0.18.0 Main UpdateLog 是由既有 CLI 建立。
  Evidence: `Get-ChildItem -Path Updates/Main/v0/v0.18 -Force` 回報 path 不存在；隨後 `yarn updatelog:new --category main --version 0.18.0 ...` 回報已生成 `Updates/Main/v0/v0.18/v0.18.0.md`。

- Observation: active ExecPlan 在目前工作樹中尚未被 git 追蹤，執行 Milestone 1 時需把它視為既有工作內容並只更新 living sections。
  Evidence: `git status --short` 回傳 `?? plans/active/readme-version-agent-workflow.exec.md`。

- Observation: Milestone 2 需要列出的 built-in system plugins 目前為 `conversation-history`、`discord`、`example`、`llm-remote-gateway`、`system-prompt-manager` 與 `talk-engine`，skill plugin 區域目前有 `example`。
  Evidence: 讀取 `src/systemPlugins/*/plugin.manifest.json` 與目錄清單後，README 只描述這些已存在的 plugins，且把 `example` 標示為 minimal fixture。

- Observation: `README.md` 的可用 Yarn commands 目前只有 `package.json` 中既有 scripts；`readme:sync-version` 與 `readme:check-version` 尚未實作。
  Evidence: `package.json` scripts 包含 `dev`、`build`、`start`、`test`、`lint` 與 `updatelog:*`，但尚未包含 README version commands。

- Observation: Milestone 2 validation 時，worktree 仍顯示 `Updates/Main/v0/v0.18/` 與本 active ExecPlan 為 untracked。
  Evidence: `git status --short` 回傳 `M README.md`、`?? Updates/Main/v0/v0.18/`、`?? plans/active/readme-version-agent-workflow.exec.md`；本 milestone 未修改 UpdateLog，`Updates/Main/v0/v0.18/` 是 Milestone 1 既有 artifact。

- Observation: Milestone 3 開始時 `tools/updatelog/lib/readme-version.js` 尚不存在，既有 helper 已提供 UpdateLog path parsing 與 strict semver parsing。
  Evidence: `Get-ChildItem -Path tools/updatelog/lib -Force` 只列出 `git.js`、`markdown.js`、`path.js`、`prompt.js`、`validate.js` 與 `version.js`；`tools/updatelog/lib/path.js` exports `parseUpdatePath` 與 `toRepoRelativePosix`，`tools/updatelog/lib/version.js` exports `parseVersion`。

- Observation: Milestone 3 narrow validation confirmed current repository state is already synchronized.
  Evidence: `node -e "const h=require('./tools/updatelog/lib/readme-version'); ..."` returned latest `v0.18.0`, README `v0.18.0`, `check.ok: true`, and `sync.changed: false`.

- Observation: Milestone 4 did not need changes to `tools/updatelog/lib/readme-version.js`; the existing helper already exports `syncReadmeVersion` and `checkReadmeVersion` with the result shapes required by the CLI.
  Evidence: `tools/updatelog/cli.js` now imports those helper functions directly, and `node tools/updatelog/cli.js check-readme-version` reports README `v0.18.0` and latest `v0.18.0`.

- Observation: README sync is idempotent in the current repository state, so running the new sync command did not create a new README modification beyond the pre-existing Milestone 2 README diff.
  Evidence: `node tools/updatelog/cli.js sync-readme-version` and `yarn readme:sync-version` both printed `changed: no`; `git status --short` still shows pre-existing `M README.md`, `?? Updates/Main/v0/v0.18/`, `?? plans/active/readme-version-agent-workflow.exec.md`, and `?? tools/updatelog/lib/readme-version.js`.

- Observation: Local PowerShell sandbox process startup remains unreliable for validation commands.
  Evidence: sandboxed `node tools/updatelog/cli.js ...`, `yarn readme:*`, and `git ...` commands first failed with `CreateProcessAsUserW failed: 5`; rerunning the same commands outside the sandbox succeeded.

- Observation: Milestone 5 ownership explicitly forbids modifying UpdateLog, README, tools, package.json, docs or tests even though normal repository governance requires UpdateLog changes for agent/documentation rules.
  Evidence: User task ownership says to modify only `AGENTS.md` and `plans/active/readme-version-agent-workflow.exec.md` living sections for Milestone 5, and says not to modify UpdateLog.

- Observation: Milestone 6 focused coverage passed without exposing defects in `tools/updatelog/lib/readme-version.js` or `tools/updatelog/cli.js`.
  Evidence: `yarn test tools/updatelog` passed with 6 test files and 20 tests; no helper or CLI implementation fix was required during Milestone 6.

- Observation: The README sync command is idempotent in the completed repository state.
  Evidence: `yarn readme:sync-version` printed `previous: v0.18.0`, `latest: v0.18.0`, and `changed: no`.

- Observation: Repository lint is feasible but still reports one warning outside this milestone's ownership.
  Evidence: `yarn lint` exited successfully with 0 errors and 1 warning at `tests/systemPlugins/discord.test.ts:379` for unused `_content`.

- Observation: `yarn readme:sync-version` only synchronizes `README.md`; the new `README.zh-TW.md` marker must be kept in sync by the agent until tooling is extended.
  Evidence: After creating `Updates/Main/v0/v0.18/v0.18.1.md`, `yarn readme:sync-version` updated `README.md` to `v0.18.1`; `README.zh-TW.md` was newly authored with the same marker value and must be checked manually.

- Observation: The old `AGENTS.md` Documentation Trust Order still described root `README.md` as empty, which became stale after v0.18.0.
  Evidence: The line was updated to treat `README.md` and `README.zh-TW.md` as orientation/history documents while still deferring implementation truth to machine-readable config, source, and tests.

- Observation: v0.18.1 README still read too much like an agent-maintenance checklist instead of a human-facing project overview.
  Evidence: User feedback said README should be the project facade for humans, describing what this project does, rather than duplicating `AGENTS.md`.

- Observation: The real default runtime stack is centered on Discord plus an OpenAI-compatible remote LLM, with TalkEngine orchestrating prompts, history, persistence, and relay.
  Evidence: `src/index.ts` starts `system:llm-remote-gateway`, `system:discord`, `system:conversation-history`, `system:system-prompt-manager`, then `system:talk-engine`; corresponding plugin manifests describe those responsibilities.

## Decision Log

- Decision: 本 ExecPlan 使用 Target Version `v0.18.0`。
  Rationale: 目前最新 Main UpdateLog 是 `v0.17.3`，而本計畫是新的文件與工具流程，不是 v0.17 system-prompt-manager 工作的 patch。
  Date/Author: 2026-05-20 / Codex

- Decision: README 顯示版本的第一版來源為 `Updates/Main` 中最新 Main UpdateLog 版本。
  Rationale: UpdateLog 是本 repository 已建立的 release history；README 的版本顯示應反映最新更新紀錄，避免手動維護造成漂移。
  Date/Author: 2026-05-20 / Codex

- Decision: `package.json` 的 `version` 也是版本同步目標，應與最新 Main UpdateLog 的 semantic version 對齊；第一版 README sync 腳本仍只自動修改 README marker。
  Rationale: 使用者確認原定規劃本就應包含 `package.json` 版本同步，只是先前未明確說明。為避免工具邊界擴大，本次保持 `yarn readme:sync-version` 只處理 README marker，但 release/update workflow 必須手動確認 `package.json` version、README marker 與最新 Main UpdateLog 一致。
  Date/Author: 2026-05-22 / User and Codex

- Decision: README version sync/check 應整合到既有 UpdateLog CLI 流程，並新增 agent 可直接執行的 package scripts。
  Rationale: Agent 已被要求使用 `yarn updatelog:new` 與 validation scripts；把 README check 接在同一工具邊界能降低遺漏率。
  Date/Author: 2026-05-20 / Codex

- Decision: `AGENTS.md` 必須明確規定 agent 在每次更新後使用 UpdateLog 工具與 README sync/check。
  Rationale: 規則只寫在 README 或 docs 容易被跳過；agent 執行時最直接的規範來源是 `AGENTS.md`。
  Date/Author: 2026-05-20 / Codex

- Decision: Milestone 1 只建立 Main UpdateLog 並更新本 ExecPlan 的 living sections，不修改 README、tool scripts、`AGENTS.md`、docs、`package.json` 或 tests。
  Rationale: 任務 owner 明確限定本 milestone 的 ownership；README、同步腳本、agent 規範、文件與測試將依後續 milestones 分別處理。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 2 的 README 只列出目前已存在的 package scripts，不預先宣告 `readme:sync-version` 或 `readme:check-version` 為可執行 commands。
  Rationale: 本 milestone ownership 明確禁止修改 tool scripts 與 `package.json`；README 應作為現況入口，未實作的 commands 留給 Milestone 3 與 Milestone 4。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 2 不修改 `Updates/Main/v0/v0.18/v0.18.0.md`。
  Rationale: 使用者限定本次 task ownership 為 `README.md` 與本 ExecPlan living sections；既有 v0.18.0 Main UpdateLog 已涵蓋 README/version sync/agent workflow 的整體計畫，Milestone 2 的實際完成狀態記錄在本 ExecPlan living sections 即可保持準確。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 3 helper 重用 `tools/updatelog/lib/path.js` 的 `parseUpdatePath` 與 `toRepoRelativePosix`，以及 `tools/updatelog/lib/version.js` 的 `parseVersion`，不重新建立另一套 UpdateLog path grammar。
  Rationale: 既有 helper 已定義 `Updates/Main/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md` 的有效路徑規則；重用它能讓 README version scan 與 UpdateLog validation 使用同一套 path convention。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 3 只新增 library helper，不修改 `tools/updatelog/cli.js`、`package.json`、README、docs、tests、`AGENTS.md` 或 UpdateLog。
  Rationale: 使用者明確限定本 milestone ownership 為 `tools/updatelog/lib/readme-version.js` 與本 ExecPlan living sections；CLI、package scripts、docs、agent 規範與 tests 留給後續 milestones。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 4 只把 README sync/check 接到 `tools/updatelog/cli.js` 與 package scripts，不接入 `updatelog:validate:staged` 或 `updatelog:validate:push`。
  Rationale: 使用者明確指出本 milestone 不要把 README check 接到 UpdateLog validate scripts；保留 validate 現有行為可避免 pre-commit/push hook 行為在本步驟中擴大。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 4 不修改 `README.md`、`AGENTS.md`、tests、UpdateLog 或 `tools/updatelog/lib/readme-version.js`。
  Rationale: 本次 ownership 限定允許修改 CLI、package scripts、docs 與本 ExecPlan living sections；直接執行 sync command 顯示 `changed: no`，因此沒有必要觸碰 README 或 helper。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 5 只修改 `AGENTS.md` 與本 ExecPlan living sections，不建立或更新 UpdateLog。
  Rationale: 一般規則要求 agent/documentation 規則變更要有 UpdateLog，但本次 task ownership 明確禁止修改 UpdateLog；為避免越權，將完成狀態、例外原因與驗證證據記錄在本 ExecPlan living sections。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 6 只新增 `tools/updatelog/__tests__/readme-version.test.js`，未修改 helper 或 CLI implementation。
  Rationale: 新增 tests 已覆蓋 ExecPlan 要求的 latest version scan、README sync、idempotence 與 check failure cases；focused suite 通過，沒有證據支持進一步修改 `tools/updatelog/lib/readme-version.js` 或 `tools/updatelog/cli.js`。
  Date/Author: 2026-05-22 / Codex

- Decision: Milestone 6 執行 `yarn lint`，並把 warning 作為 residual risk 記錄，不在本 milestone 修正。
  Rationale: lint command 可行且使用者要求可行時執行；唯一 warning 位於 `tests/systemPlugins/discord.test.ts`，不屬於本次 task ownership 的 updatelog tests 或 README version workflow。
  Date/Author: 2026-05-22 / Codex

- Decision: v0.18.1 使用 `README.zh-TW.md` 作為繁體中文入口文件檔名。
  Rationale: `zh-TW` 明確表示繁體中文，且與常見 locale naming 一致；保留根目錄 `README.md` 作為英文入口，兩者用相對連結互相指向。
  Date/Author: 2026-05-22 / Codex

- Decision: 雙語 README 一致性第一版採用嚴格規範與最終人工 consistency check，不在本 patch 新增自動語意比對工具。
  Rationale: 兩種語言的「內容等價」無法可靠用簡單字串比較判斷；本 patch 先把章節順序、facts、commands、版本 marker 與維護規範的同步責任寫入 `AGENTS.md` 與 `.agent/PLANS.md`，並要求最終動作檢查。後續若需要可新增專用 checker。
  Date/Author: 2026-05-22 / Codex

- Decision: v0.18.2 README 刻意移除大部分 agent 操作語氣，只保留通往 `AGENTS.md`、`.agent/PLANS.md` 與 `Updates` 的簡短導覽。
  Rationale: README 是 repository 門面，主要讀者是人類維護者或新讀者；具體 agent 規則已由 `AGENTS.md` 與 `.agent/PLANS.md` 承擔，README 不應重複成為 AI 操作手冊。
  Date/Author: 2026-05-22 / Codex

## Outcomes & Retrospective

本 ExecPlan 初始建立完成後，尚未交付 README、同步腳本、UpdateLog CLI 整合或 agent 規範變更。下一位執行者應從 Milestone 1 開始，先建立 `v0.18.0` 的 Main UpdateLog，再依序推進 README、工具、規範與測試。

Milestone 1 已完成。`Updates/Main/v0/v0.18/v0.18.0.md` 已由 repository UpdateLog CLI 建立，內容具體描述 README version sync、UpdateLog 整合與 agent workflow 的規劃基線，並已通過 repository UpdateLog validator 直接驗證；本 milestone 未修改 README、tool scripts、`AGENTS.md`、docs、`package.json` 或 tests。後續執行者應從 Milestone 2 開始補完整根目錄 README，並保持 v0.18.0 Main UpdateLog 與本 ExecPlan 同步。

Milestone 2 已完成。`README.md` 已從空檔補成 repository entry point，並包含精確的 `Current release: <!-- DEMONKERNEL_VERSION:start -->v0.18.0<!-- DEMONKERNEL_VERSION:end -->` marker、核心架構導覽、內建 system plugins、現有 Yarn commands、UpdateLog workflow、ExecPlan usage、agent maintenance notes 與 documentation trust order。本 milestone 沒有新增 README sync/check scripts，也沒有修改 `AGENTS.md`、docs、`package.json`、tests、tool scripts 或 UpdateLog；後續執行者應從 Milestone 3 建立 README 版本同步 helper。

Milestone 3 已完成。`tools/updatelog/lib/readme-version.js` 已新增 CommonJS helper，會只掃描符合 Main UpdateLog path 規範的 markdown 檔，使用 semantic version 排序取得最新版本，並以唯一、單行、精確格式的 `DEMONKERNEL_VERSION` marker 讀取、同步與檢查 README 顯示版本。此 milestone 未整合 CLI 或 package scripts，也未新增 tests，因本次 ownership 明確禁止修改那些檔案；後續執行者應從 Milestone 4 將 helper 接到 UpdateLog CLI 與 package scripts，並在 Milestone 6 補 focused tests。

Milestone 4 已完成。`tools/updatelog/cli.js` 現在提供 `sync-readme-version` 與 `check-readme-version`，會分別印出 previous/latest/changed 與 readme/latest/error details；`package.json` 已新增 `yarn readme:sync-version` 與 `yarn readme:check-version`；`docs/updatelog-spec.md` 已記錄命令、Yarn scripts、唯一單行 marker contract，以及第一版不接入 `updatelog:validate:*` 的界線。直接 Node CLI 與 Yarn script 驗證都通過，sync 在目前 repository 狀態回報 `changed: no`。後續執行者應從 Milestone 5 補強 `AGENTS.md`，再於 Milestone 6 補 focused tests。

Milestone 5 已完成。`AGENTS.md` 的 UpdateLog 與 Release Notes 區域已改為要求 agent 使用 `yarn updatelog:new` 或 `node tools/updatelog/cli.js new` 建立 UpdateLog，新增 Main UpdateLog 後在 README 版本落後時執行 `yarn readme:sync-version`，結束前執行 `yarn readme:check-version`，並規定 README version marker 不應長期手動維護。若同步工具失敗且必須手動修正，原因需寫入 UpdateLog Notes；final report 也必須列出 UpdateLog validation 與 README version check。本 milestone 依 task ownership 未修改 README、tools、package.json、docs、tests 或 UpdateLog；後續執行者應從 Milestone 6 補 focused tests。

Milestone 6 已完成。`tools/updatelog/__tests__/readme-version.test.js` 已使用 temp directory fixtures 補齊 focused coverage，確認 `findLatestMainUpdateVersion` 只採用 valid Main UpdateLog paths 並以 semantic version 找最大值，`syncReadmeVersion` 可從舊 README marker 同步到 latest version，重跑 sync 會回傳 `changed: false` 且不改動檔案內容，`checkReadmeVersion` 對 missing marker、duplicate marker 與 lagging version 都會失敗並提供清楚錯誤。`yarn test tools/updatelog` 通過且既有 UpdateLog validate tests 未被破壞；README sync/check、staged UpdateLog validation 與 lint 也已執行並記錄。

本 ExecPlan 已完成。`README.md` 已能作為 repository entry point；README 顯示版本可由 `Updates/Main` 最新 Main UpdateLog 同步；README 版本落後、marker 缺失或 marker 重複時會被 check helper/CLI 偵測；`AGENTS.md` 已要求後續 agent 使用 UpdateLog tooling、README sync/check 與 final validation reporting。剩餘風險是 `yarn lint` 仍顯示 `tests/systemPlugins/discord.test.ts:379` 的既有 unused variable warning，該檔不屬於本 milestone ownership，未在本次修正。

v0.18.1 patch 已完成文件規範補強。`README.zh-TW.md` 已新增為繁體中文入口文件，`README.md` 與 `README.zh-TW.md` 已互相連結並維持相同章節順序與等價內容；`AGENTS.md` 已嚴格要求雙語 README 同步與 final report consistency check；`.agent/PLANS.md` 已要求每份 ExecPlan 的最後一個實作步驟必須是 README consistency check。剩餘風險是目前 `yarn readme:sync-version` 只自動更新 `README.md`，因此 `README.zh-TW.md` 的 marker 與內容仍需依新規範手動檢查，直到後續 patch 新增雙語 checker。

v0.18.2 patch 已完成 README 重寫。`README.md` 與 `README.zh-TW.md` 現在以人類讀者為主，說明 Demonkernel 是 plugin-based AI conversation runtime、預設啟動哪些 system plugins、capability/provider runtime 如何運作、如何 build/run/test、重要設定為何，以及去哪裡看 contributor rules、ExecPlans 與 release history。README 不再承擔 agent 操作規範；那些規則保留在 `AGENTS.md` 與 `.agent/PLANS.md`。本 patch 也把 `package.json` version 明確納入版本同步目標，現況 `package.json` 的 `version` 為 `0.18.2`，與最新 Main UpdateLog `v0.18.2` 及 README marker 對齊。

## Context and Orientation

Demonkernel 是 TypeScript Node 專案，也是一個 plugin-oriented runtime。`plugin-oriented runtime` 在本 repository 中是指核心 runtime 透過 plugin manifest 載入 system plugins 與 skill plugins，並由 `src/core/pluginsManager` 管理 discovery、manifest validation、dependency-aware lifecycle orchestration 與 capability provider registration。

本計畫會碰到的主要檔案與目錄如下：

- `README.md`：根目錄入口文件。現況是空檔，本計畫要讓它成為專案導覽與版本資訊入口。
- `package.json`：Yarn scripts 與 npm package metadata 的 machine-readable 來源。版本欄位也是 release/update 目標；本計畫將它對齊最新 Main UpdateLog 的 semantic version，但目前 README sync 工具不會自動修改它。
- `Updates/Main`：全域更新紀錄目錄。現況最新是 `Updates/Main/v0/v0.17/v0.17.3.md`。
- `tools/updatelog/cli.js`：既有 UpdateLog CLI，已支援 `new`、`ensure`、`validate`。
- `tools/updatelog/lib/*`：UpdateLog CLI 的 path、version、markdown、validate 與 git helper。
- `docs/updatelog-spec.md`：UpdateLog 格式與 CLI 使用說明。
- `AGENTS.md`：agent 在本 repository 中工作的規範。後續要補強 README sync 與 UpdateLog tool usage。
- `.agent/PLANS.md`：ExecPlan 規範。重大、多步驟或高風險工作都要從 active ExecPlan 推進。

本計畫使用幾個專門術語：

- UpdateLog：`Updates/Main` 或 `Updates/Plugins/...` 下的 markdown 更新紀錄，包含 Summary、Changes、Impact、Tests、Risks & Rollback 與 Notes。
- README sync：從最新 Main UpdateLog 版本讀出目前專案顯示版本，並更新 `README.md` 中固定版本欄位或標記區塊的工具行為。
- README check：檢查 `README.md` 中的顯示版本是否等於最新 Main UpdateLog；不修改檔案，失敗時回傳非零 exit code。
- Agent 規範：`AGENTS.md` 中對後續 coding agent 的工作要求，包含必用工具、驗證命令與不得手動長期維護的欄位。

## Plan of Work

Milestone 1: 固定版本來源與 README 同步規則。

先建立或更新 `Updates/Main/v0/v0.18/v0.18.0.md`，因為 `.agent/PLANS.md` 規定每份 ExecPlan 都必須維護對應的 Main UpdateLog。這份 UpdateLog 要記錄本計畫會補 README、README version sync、UpdateLog 整合與 agent 規範。接著在本 ExecPlan 的 `Decision Log` 保持目前決策：README 顯示版本與 `package.json` version 都應對齊 `Updates/Main` 最新版本；第一版腳本只自動同步 README，不自動修改 `package.json`。

Milestone 2: 補完整根目錄 README。

將空的 `README.md` 補成 repository 入口文件。README 應包含：專案定位、目前顯示版本、核心架構導覽、內建 system plugins、常用 Yarn 指令、UpdateLog 工作流、ExecPlan 使用時機與 agent 維護注意事項。README 不取代 `AGENTS.md`、`.agent/PLANS.md`、docs、source 或 tests；當來源衝突時，README 要明確指向 machine-readable config、source、tests 與正式 docs。

README 的版本欄位必須使用固定標記，讓同步腳本能穩定修改。採用下列單行標記格式：

    Current release: <!-- DEMONKERNEL_VERSION:start -->v0.18.0<!-- DEMONKERNEL_VERSION:end -->

腳本只允許替換這兩個 marker 中間的內容。若 marker 不存在、重複或跨多行格式異常，腳本必須失敗。

Milestone 3: 建立 README 版本同步腳本。

新增 `tools/updatelog/lib/readme-version.js`，提供純函式供測試與 CLI 共用：

- `findLatestMainUpdateVersion(repoRoot): string`
- `readReadmeVersion(repoRoot): string`
- `syncReadmeVersion(repoRoot): { previousVersion: string | null; nextVersion: string; changed: boolean }`
- `checkReadmeVersion(repoRoot): { ok: boolean; readmeVersion: string | null; latestVersion: string; error?: string }`

版本格式統一使用 README 顯示用的 `vX.Y.Z`。掃描 `Updates/Main` 時要只接受符合既有 UpdateLog path 規範的 Main markdown 檔，並以 semantic version 排序取得最大版本，不依賴檔案修改時間。

Milestone 4: 整合 UpdateLog CLI 與 README sync/check 流程。

延伸 `tools/updatelog/cli.js`，新增兩個子命令：

- `node tools/updatelog/cli.js sync-readme-version`
- `node tools/updatelog/cli.js check-readme-version`

`sync-readme-version` 會更新 README marker 中的版本。`check-readme-version` 不寫檔，若 README 版本與最新 Main UpdateLog 不一致，回傳 exit code 1 並印出目前 README 版本與最新 UpdateLog 版本。

在 `package.json` 新增 scripts：

- `readme:sync-version`: `node tools/updatelog/cli.js sync-readme-version`
- `readme:check-version`: `node tools/updatelog/cli.js check-readme-version`

`updatelog:validate:staged` 與 `updatelog:validate:push` 第一版先不自動執行 README check，避免改變既有 hook 行為太多；但 `AGENTS.md` 必須要求 agent 在更新後手動執行 `yarn readme:check-version`。若後續維護者想把 README check 納入 validate，可作為 `v0.18.x` patch 另行追加。

Milestone 5: 補強 `AGENTS.md` 的 agent 更新規範。

在 `AGENTS.md` 的 UpdateLog 與 Release Notes 區域新增 README version sync 規則。規範必須說明：

- 行為變更、文件規則變更、plugin 變更、capability contract 變更、diagnostics/logging 行為變更、secret handling 變更都必須建立或更新 UpdateLog。
- Agent 必須使用 `yarn updatelog:new` 或 `node tools/updatelog/cli.js new`，不得手動亂建不符合路徑規範的 UpdateLog。
- 新增 Main UpdateLog 後，若 README 顯示版本落後，必須執行 `yarn readme:sync-version`。
- 更新完成前必須執行 `yarn readme:check-version`。
- README 版本 marker 不得手動長期維護；若同步工具壞掉且必須手動修正，需在 UpdateLog Notes 記錄原因。
- 最終回報需列出已執行的 UpdateLog validation 與 README version check。

Milestone 6: 補測試與驗證路徑。

新增或更新 `tools/updatelog/__tests__` 下的 focused tests。測試應使用臨時目錄 fixture，不改 repository root。至少覆蓋：

- 能從多個 `Updates/Main/v*/v*.*/*.md` 檔案中找出最大 semantic version。
- 能把 README marker 中的舊版本改成最新版本。
- 重跑 sync 時 `changed` 是 `false`，且檔案不產生新差異。
- README 缺 marker、marker 重複、版本落後時，check 會失敗並提供清楚錯誤。
- 既有 UpdateLog validate tests 不被破壞。

Patch Milestone 7: 新增繁體中文 README 與雙語一致性規範。

新增 `README.zh-TW.md`，內容與 `README.md` 等價且維持相同章節順序。在 `README.md` 加入連到 `README.zh-TW.md` 的語言連結，並在 `README.zh-TW.md` 加入連回 `README.md` 的語言連結。更新 `AGENTS.md`，要求所有後續 agent 在 README 相關內容變更時同步兩種語言，並在最終回報列出雙語 README consistency check。更新 `.agent/PLANS.md`，要求每份 ExecPlan 的最後一個實作步驟必須確認兩份 README 互相連結、章節順序一致、facts/commands/version marker/maintenance guidance 等價，並執行 `yarn readme:check-version`。

## Concrete Steps

以下步驟從 repository root `E:\ai-training\demonkernel` 執行。

1. 建立 v0.18.0 Main UpdateLog：

       yarn updatelog:new --category main --version 0.18.0 --summary "建立 README 版本同步與 agent 更新流程規範" --added "新增 README 版本同步與 agent 更新流程 ExecPlan" --changed "規劃 README 顯示版本與 UpdateLog 最新版本同步" --fixed "本版未修正既有 runtime bug" --removed "本版未移除既有功能" --impact "後續 agent 可依 ExecPlan 補齊 README、版本同步腳本與更新規範" --tests "尚未執行實作測試；本次先建立 ExecPlan" --risks "本次僅建立計畫，實作風險留待後續 milestone 驗證" --notes "Target Version: v0.18.0"

2. 補 `README.md`，加入固定版本 marker 與專案導覽。初始版本 marker 應指向 `v0.18.0`，因為本 ExecPlan 的 Target Version 是 v0.18.0。

3. 新增 `tools/updatelog/lib/readme-version.js`，以純函式實作 latest Main UpdateLog version 掃描、README marker read、sync 與 check。

4. 延伸 `tools/updatelog/cli.js`，新增 `sync-readme-version` 與 `check-readme-version` 子命令，並更新 help output。

5. 更新 `package.json` scripts，加入 `readme:sync-version` 與 `readme:check-version`，並把 `version` 對齊本次最新 Main UpdateLog 的 semantic version。

6. 更新 `docs/updatelog-spec.md`，補上 README version sync/check CLI 說明。

7. 更新 `AGENTS.md`，加入 agent 更新後必須使用 README sync/check 與 UpdateLog validation 的規範。

8. 新增或更新 tests：

       yarn test tools/updatelog

9. 執行 README version commands：

       yarn readme:sync-version
       yarn readme:check-version

10. 執行 UpdateLog validation：

       yarn updatelog:validate:staged

11. 若本次修改碰到 TypeScript 或 repository-wide lint 相關檔案，再執行：

       yarn lint

12. 每份 ExecPlan 的最後一個實作動作必須執行 README consistency check：確認 `README.md` 與 `README.zh-TW.md` 都已更新或已判定不需更新，兩份文件互相連結，章節順序一致，facts、commands、release marker 與維護規範等價，並執行：

       yarn readme:check-version

每次停止前，更新本 ExecPlan 的 `Progress`、`Surprises & Discoveries`、`Decision Log`、`Artifacts and Notes` 與 `Outcomes & Retrospective`。

## Validation and Acceptance

本計畫完成後，應滿足以下可觀察結果：

- `README.md` 不再是空檔，並能作為 repository 入口說明 Demonkernel 的專案定位、核心架構、system plugins、常用指令與維護流程。
- `README.md` 包含唯一一組版本 marker：`DEMONKERNEL_VERSION:start` 與 `DEMONKERNEL_VERSION:end`。
- `yarn readme:sync-version` 會把 README 版本 marker 中的值同步成最新 Main UpdateLog 版本。
- `yarn readme:check-version` 在 README 版本等於最新 Main UpdateLog 時通過；版本落後、marker 缺失或 marker 重複時失敗。
- `package.json` 的 `version` 與最新 Main UpdateLog 的 semantic version 對齊；現有 README sync/check 工具不自動驗證 package version，因此 final validation 需人工列出檢查結果。
- `tools/updatelog` tests 覆蓋 latest version scan、README sync、README check failure 與 idempotence。
- `docs/updatelog-spec.md` 記錄 README sync/check command。
- `AGENTS.md` 明確要求 agent 使用 UpdateLog 工具、README sync/check 與 validation commands。
- `Updates/Main/v0/v0.18/v0.18.0.md` 存在且內容不使用 placeholder。
- `README.zh-TW.md` 存在，與 `README.md` 互相連結，並維持相同章節順序、相同 repository facts、相同 command lists、相同 release marker value 與等價維護規範。
- `.agent/PLANS.md` 明確要求每份 ExecPlan 的最後一個實作步驟是 README consistency check。

## Idempotence and Recovery

README sync 必須可安全重跑。當 README marker 版本已等於最新 Main UpdateLog 時，`yarn readme:sync-version` 應回報 unchanged 或等價結果，且不產生不必要 diff。

如果 README marker 缺失或重複，sync/check 不應猜測位置，也不應重寫整份 README；應明確失敗並要求維護者修正 marker。恢復方式是手動把 README 調回單一 marker 格式：

    Current release: <!-- DEMONKERNEL_VERSION:start -->vX.Y.Z<!-- DEMONKERNEL_VERSION:end -->

如果 latest version 掃描失敗，先檢查 `Updates/Main` 是否有符合 `Updates/Main/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md` 的檔案，並確認 UpdateLog metadata 與檔名版本一致。

如果 `package.json` 版本與 README 顯示版本或最新 Main UpdateLog 不一致，先以 `Updates/Main` 最新有效 Main UpdateLog 為準，手動修正 `package.json` 的 `version` 或 README marker，然後重跑 `yarn readme:check-version` 與 `yarn updatelog:validate:staged`。目前 `yarn readme:sync-version` 不會自動修改 `package.json`。

如果 `README.md` 與 `README.zh-TW.md` 不一致，恢復方式是先以最新 source/config/tests/UpdateLog 驗證事實，再同步改兩份 README。不要只用其中一份覆蓋另一份；必須確認翻譯後的資訊等價、章節順序一致、commands 相同、version marker 相同且雙向連結存在。

## Artifacts and Notes

初始探索證據：

- `plans/active` 目前只有 `.gitkeep`，沒有其他 active ExecPlan。
- 最新 Main UpdateLog 路徑包含 `Updates/Main/v0/v0.17/v0.17.3.md`。
- `README.md` byte size 是 0。
- `package.json` 的 `version` 是 `0.15.2`。
- `package.json` 目前已有 `updatelog:new`、`updatelog:ensure`、`updatelog:validate:staged` 與 `updatelog:validate:push` scripts。

本 ExecPlan 初始建立時只新增計畫檔，尚未執行 README、CLI、AGENTS 或 UpdateLog 實作變更。

Milestone 1 執行證據：

- `yarn updatelog:new --category main --version 0.18.0 ...` 成功，輸出 `[updatelog] 已生成: Updates/Main/v0/v0.18/v0.18.0.md`。
- `node -e "const { validateUpdateFiles } = require('./tools/updatelog/lib/validate'); ..."` 成功，輸出 `[updatelog] direct validate 通過: Updates/Main/v0/v0.18/v0.18.0.md`。
- `Updates/Main/v0/v0.18/v0.18.0.md` Metadata: Category `main`、Scope `Main`、Version `0.18.0`、Date `2026-05-22`。
- `git status --short` 在 Milestone 1 開始時顯示 `?? plans/active/readme-version-agent-workflow.exec.md`，表示此 active plan 尚未被 git 追蹤；本次仍只依任務 ownership 更新其 living sections。

Milestone 2 執行證據：

- `README.md` 現在包含固定 marker：`Current release: <!-- DEMONKERNEL_VERSION:start -->v0.18.0<!-- DEMONKERNEL_VERSION:end -->`。
- `README.md` 的 built-in system plugins 清單依 `src/systemPlugins` 現況列出 `conversation-history`、`discord`、`llm-remote-gateway`、`system-prompt-manager`、`talk-engine` 與 `example`。
- `README.md` 的 command section 只列出 `package.json` 目前存在的 `yarn dev`、`yarn build`、`yarn start`、`yarn test`、`yarn lint` 與 `yarn updatelog:*` commands。
- 本 milestone 的檔案 ownership 維持在 `README.md` 與 `plans/active/readme-version-agent-workflow.exec.md`。
- `Select-String -Path README.md -Pattern "DEMONKERNEL_VERSION:start|DEMONKERNEL_VERSION:end"` 成功，輸出顯示 marker 位於 `README.md:3`。
- `git diff -- README.md plans/active/readme-version-agent-workflow.exec.md` 成功檢視 README diff；因本 ExecPlan 目前未被 git 追蹤，該 command 只顯示 tracked `README.md` diff。
- `git status --short` 顯示 `M README.md`、`?? Updates/Main/v0/v0.18/`、`?? plans/active/readme-version-agent-workflow.exec.md`；未出現 tool scripts、`AGENTS.md`、docs、`package.json` 或 tests 的修改。

Milestone 3 執行證據：

- 新增 `tools/updatelog/lib/readme-version.js`，exports `findLatestMainUpdateVersion`、`readReadmeVersion`、`syncReadmeVersion` 與 `checkReadmeVersion`。
- `findLatestMainUpdateVersion(repoRoot)` 透過 `parseUpdatePath` 只接受 valid Main UpdateLog paths，並用 `parseVersion` 後的 `major`、`minor`、`patch` 做 semantic sort，不依賴檔案修改時間。
- `readReadmeVersion(repoRoot)` 要求唯一 marker，格式為 `<!-- DEMONKERNEL_VERSION:start -->vX.Y.Z<!-- DEMONKERNEL_VERSION:end -->`；missing、duplicate 或 malformed markers 會丟出清楚錯誤。
- `checkReadmeVersion(repoRoot)` 在目前 repository 回傳 `{ ok: true, readmeVersion: "v0.18.0", latestVersion: "v0.18.0" }`。
- `syncReadmeVersion(repoRoot)` 在目前 repository 回傳 `{ previousVersion: "v0.18.0", nextVersion: "v0.18.0", changed: false }`，表示重跑不會產生不必要 diff。
- Validation command first hit a Windows sandbox `CreateProcessAsUserW failed: 5`; rerunning the same local Node validation outside the sandbox succeeded with the expected JSON output.

Milestone 4 執行證據：

- `tools/updatelog/cli.js` 新增 `require("./lib/readme-version")`，並在 command dispatcher 中處理 `sync-readme-version` 與 `check-readme-version`。
- `node tools/updatelog/cli.js help` 顯示新增用法：`node tools/updatelog/cli.js sync-readme-version` 與 `node tools/updatelog/cli.js check-readme-version`。
- `package.json` scripts 新增 `readme:sync-version` 與 `readme:check-version`，分別指向新的 CLI subcommands。
- `docs/updatelog-spec.md` 新增 README version sync/check command 說明、Yarn script 說明、marker contract，以及「第一版不接入 `updatelog:validate:staged` / `updatelog:validate:push`」的明確界線。
- `node tools/updatelog/cli.js check-readme-version` 成功，輸出 `[updatelog] README version check 通過`、`readme: v0.18.0`、`latest: v0.18.0`。
- `node tools/updatelog/cli.js sync-readme-version` 成功，輸出 `previous: v0.18.0`、`latest: v0.18.0`、`changed: no`。
- `yarn readme:check-version` 成功，透過 package script 執行同一個 check command。
- `yarn readme:sync-version` 成功，透過 package script 執行同一個 sync command，並回報 `changed: no`。
- 沙盒中的 PowerShell command startup 多次回報 `CreateProcessAsUserW failed: 5`；相同 validation commands 以 escalated run 重新執行後成功。

Milestone 5 執行證據：

- `AGENTS.md` 的 UpdateLog 與 Release Notes 區域現在要求使用 `yarn updatelog:new` 或 `node tools/updatelog/cli.js new`，並明確禁止手動亂建不符合路徑規範的 UpdateLog。
- 同一段落現在要求新增或更新 Main UpdateLog 後，若 README 顯示版本落後，執行 `yarn readme:sync-version`；每次更新完成前執行 `yarn readme:check-version`。
- 同一段落現在明確說明 README version marker 不應長期手動維護；若同步工具失敗且必須手動修正，需在 UpdateLog Notes 記錄原因。
- 同一段落現在要求 final report 列出 UpdateLog validation 與 README version check；若因 ownership 或工具限制無法修改 UpdateLog 或執行驗證，也必須說明原因。
- `yarn readme:check-version` 成功，輸出 README version check 通過，`readme: v0.18.0`，`latest: v0.18.0`。
- `yarn updatelog:validate:staged` 成功，輸出 `validate(staged) 通過`。
- 本 milestone 依 task ownership 只修改 `AGENTS.md` 與 `plans/active/readme-version-agent-workflow.exec.md` living sections。

Milestone 6 執行證據：

- 新增 `tools/updatelog/__tests__/readme-version.test.js`，所有 fixtures 都透過 `fs.mkdtempSync(path.join(os.tmpdir(), "readme-version-test-"))` 建立，未寫入 repository root。
- `yarn test tools/updatelog` 成功，輸出 `Test Files 6 passed (6)` 與 `Tests 20 passed (20)`；其中 `readme-version.test.js` 有 6 個 tests。
- `yarn readme:sync-version` 成功，輸出 `previous: v0.18.0`、`latest: v0.18.0`、`changed: no`。
- `yarn readme:check-version` 成功，輸出 `README version check 通過`、`readme: v0.18.0`、`latest: v0.18.0`。
- `yarn updatelog:validate:staged` 成功，輸出 `validate(staged) 通過`。
- Direct UpdateLog validation 成功，輸出 `[updatelog] direct validate 通過: Updates/Main/v0/v0.18/v0.18.0.md`。
- `yarn lint` 成功且無 error；輸出仍包含 `tests/systemPlugins/discord.test.ts:379` 的 `_content` unused warning。
- Milestone 6 初次 sandboxed validation commands 仍可能遇到 Windows `CreateProcessAsUserW failed: 5`；使用 approved escalated runs 重新執行後，上述 validation commands 均成功。

v0.18.1 patch 執行證據：

- `yarn updatelog:new --category main --version 0.18.1 ...` 成功，輸出 `[updatelog] 已生成: Updates/Main/v0/v0.18/v0.18.1.md`。
- `yarn readme:sync-version` 成功，輸出 `previous: v0.18.0`、`latest: v0.18.1`、`changed: yes`。
- `README.md` 現在包含 `Language: English | [繁體中文](README.zh-TW.md)`。
- `README.zh-TW.md` 現在包含 `語言：[English](README.md) | 繁體中文`。
- `AGENTS.md` 新增 `README 與雙語文件同步` section，要求雙語 README 同步與 final consistency check。
- `.agent/PLANS.md` 新增 README 雙語同步規則，並在 ExecPlan 骨架中要求最後一個實作步驟是 README consistency check。
- `yarn readme:check-version` 成功，輸出 `README version check 通過`、`readme: v0.18.1`、`latest: v0.18.1`。
- `yarn updatelog:validate:staged` 成功，輸出 `validate(staged) 通過`。
- Read-only heading/marker check 成功：`README.md` headings 為 `Project Layout | Core Architecture | Built-In System Plugins | Common Commands | Bilingual README Maintenance | UpdateLog Workflow | ExecPlan Usage | Agent Maintenance Notes | Documentation Trust Order`；`README.zh-TW.md` headings 為 `專案結構 | 核心架構 | 內建 System Plugins | 常用命令 | 雙語 README 維護 | UpdateLog 工作流 | ExecPlan 使用 | Agent 維護注意事項 | 文件信任順序`；兩份 marker 皆為 `v0.18.1`。

v0.18.2 patch 執行證據：

- `yarn updatelog:new --category main --version 0.18.2 ...` 成功，輸出 `[updatelog] 已生成: Updates/Main/v0/v0.18/v0.18.2.md`。
- `yarn readme:sync-version` 成功，輸出 `previous: v0.18.1`、`latest: v0.18.2`、`changed: yes`。
- `README.md` 與 `README.zh-TW.md` 已改為相同章節順序：project purpose、runtime stack、runtime model、built-in components、quick start、configuration、project structure、documentation and releases。
- `package.json` 的 `version` 已更新為 `0.18.2`，與最新 Main UpdateLog `v0.18.2` 的 semantic version 對齊。
- `yarn readme:check-version` 成功，輸出 `README version check 通過`、`readme: v0.18.2`、`latest: v0.18.2`。
- `yarn updatelog:validate:staged` 成功，輸出 `validate(staged) 通過`。
- Review 修正後補充確認：雙語 README consistency check 覆蓋雙向連結、章節順序、repository facts、command lists、release marker value、維護規範入口與 `package.json` version；檢查結果已寫入 `Updates/Main/v0/v0.18/v0.18.2.md`。

## Interfaces and Dependencies

本計畫第一階段不新增 npm dependency。README version sync 應使用 Node.js built-in modules，例如 `fs`、`path`，並重用既有 `tools/updatelog/lib/version.js` 與 `tools/updatelog/lib/path.js` 的版本解析與路徑規則。

新增內部 helper module：

- `tools/updatelog/lib/readme-version.js`

新增 CLI commands：

- `node tools/updatelog/cli.js sync-readme-version`
- `node tools/updatelog/cli.js check-readme-version`

新增 package scripts：

- `yarn readme:sync-version`
- `yarn readme:check-version`

README marker interface 固定為：

    <!-- DEMONKERNEL_VERSION:start -->vX.Y.Z<!-- DEMONKERNEL_VERSION:end -->

雙語 README interface 固定為：

- 英文入口：`README.md`
- 繁體中文入口：`README.zh-TW.md`
- 兩份文件必須互相連結，且同時包含相同 release marker value。

第一版不變更 runtime TypeScript interfaces、plugin manifest schema、capability schema、registry behavior、system plugin lifecycle 或 external service integration。
