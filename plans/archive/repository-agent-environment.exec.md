# 穩定 Repository Agent 環境

本 ExecPlan 是 living document。隨著工作推進，必須持續更新 `Progress`、`Surprises & Discoveries`、`Decision Log` 與 `Outcomes & Retrospective`。

本 ExecPlan 依 `.agent/PLANS.md` 維護；該文件已將 OpenAI Cookbook 的 Codex ExecPlan guide 改寫為適合本 repository 使用的繁體中文規範。

Target Version: v0.16.0

## Purpose / Big Picture

完成這次變更後，後續在本 repository 工作的 Codex agents 會有穩定的導覽層。新的或無先前記憶的 agent 應能閱讀 `AGENTS.md` 理解 repository 佈局，使用 `.agent/PLANS.md` 管理長時間實作工作，並在需要更深背景時查閱本 ExecPlan 的 `Archived Reconnaissance Reports`。可觀察結果是一次純文件變更：`AGENTS.md`、`.agent/PLANS.md`、本 ExecPlan，以及已歸檔到本 ExecPlan 的指定報告內容都存在，並說明如何在不修改 production code 的前提下於本 repository 工作。

## Progress

- [x] (2026-05-16 Asia/Taipei) 建立 `.agent/`、`.agent/reports/` 與 `plans/active/`。
- [x] (2026-05-16 Asia/Taipei) 建立繁體中文 `.agent/PLANS.md`，並對齊 OpenAI Codex ExecPlan guide。
- [x] (2026-05-16 Asia/Taipei) 建立本 ExecPlan：`plans/active/repository-agent-environment.exec.md`，並更新為引用 `.agent/PLANS.md`。
- [x] (2026-05-16 Asia/Taipei) 派出六個範圍限定的偵察 subagents，分別閱讀 `Updates/`、`docs/`、`tests/`、`src/core/`、插件目錄與 tooling/README 檔案。
- [x] (2026-05-16 Asia/Taipei) 收齊六份 `.agent/reports/` 報告。
- [x] (2026-05-16 Asia/Taipei) 根據六份報告與選定根目錄檔案產生 `.agent/reports/repository-architecture-report.md`。
- [x] (2026-05-16 Asia/Taipei) 根據報告重寫 root `AGENTS.md`。
- [x] (2026-05-16 Asia/Taipei) 使用 `git status --short` 驗證變更集；只有 `.agent/`、`AGENTS.md` 與 `plans/` 顯示為變更或未追蹤路徑。
- [x] (2026-05-16 Asia/Taipei) 更新本 ExecPlan 的最終進度、決策、產物與回顧。
- [x] (2026-05-17 Asia/Taipei) 依使用者要求，將本 active ExecPlan 內文改寫為繁體中文。
- [x] (2026-05-17 Asia/Taipei) 將 `.agent/reports/*.md` 七份報告完整併入本 ExecPlan 的 `Archived Reconnaissance Reports` section。
- [x] (2026-05-17 Asia/Taipei) 刪除已歸檔的 `.agent/reports` 暫存目錄。
- [x] (2026-05-17 Asia/Taipei) 依使用者要求，將 root `AGENTS.md` 改寫為繁體中文。
- [x] (2026-05-17 Asia/Taipei) 補記 `AGENTS.md` 中文化到本 ExecPlan 的 living sections。
- [x] (2026-05-17 Asia/Taipei) 使用 `node tools\updatelog\cli.js new` 建立 `Updates/Main/v0/v0.16/v0.16.0.md`。
- [x] (2026-05-17 Asia/Taipei) 將每次更新必須建立 UpdateLog、`Updates/Main` 全域索引、ExecPlan Target Version 與 Major/Minor/Patch 規則寫入 `AGENTS.md` 與 `.agent/PLANS.md`。
- [x] (2026-05-17 Asia/Taipei) 將本 ExecPlan 綁定 `Target Version: v0.16.0`。
- [x] (2026-05-17 Asia/Taipei) 使用 `node tools\updatelog\cli.js new` 建立同一 ExecPlan 後續補充任務的 Patch 紀錄 `Updates/Main/v0/v0.16/v0.16.1.md`。

## Surprises & Discoveries

- Observation: repository 已經有 root `AGENTS.md`。
  Evidence: `Get-ChildItem -Force` 顯示 `E:\ai-training\demonkernel\AGENTS.md`。
- Observation: 實際插件目錄位於 `src/systemPlugins` 與 `src/skillPlugins`。
  Evidence: `Get-ChildItem -Directory src` 列出 `src\core`、`src\skillPlugins` 與 `src\systemPlugins`。
- Observation: OpenAI Cookbook ExecPlan 文章目前可由 `https://developers.openai.com/cookbook/articles/codex_exec_plans` 取得。
  Evidence: 擷取到的頁面包含 `PLANS.md` skeleton 與必要 sections。
- Observation: root `README.md` 目前是空檔，不應視為可靠架構來源。
  Evidence: repository architecture report 讀取 `README.md` 後未找到內容。
- Observation: 最終 git status 顯示本輪沒有直接修改 `src/`、`tests/`、`docs/`、`Updates/` 或 `tools/`。
  Evidence: `git status --short` 只回傳 `?? .agent/`、`?? AGENTS.md` 與 `?? plans/`。
- Observation: 七份偵察報告已併入本 ExecPlan，原 `.agent/reports` 不再作為獨立暫存資料夾存在。
  Evidence: `Select-String` 在本檔案找到 `Archived Reconnaissance Reports` 與七個 `Archived Report:` headings；刪除命令先確認 `.agent\reports` resolved path 位於 workspace 內，再執行 `Remove-Item -LiteralPath $target -Recurse -Force`。
- Observation: 報告歸檔後的 git status 額外顯示 `.gitignore` 已修改。
  Evidence: `git diff -- .gitignore` 顯示新增 `.agent/reports/` ignore entry；本次沒有依賴此變更來完成歸檔或刪除。
- Observation: `AGENTS.md` 已從英文 repository guide 改寫為繁體中文 guide。
  Evidence: `Get-Content -Path AGENTS.md | Select-Object -First 40` 顯示標題為 `# Repository 指南`，並包含繁體中文的專案結構、ExecPlans、commands、plugin rules 與 testing sections。
- Observation: 最新既有 Main UpdateLog 是 `0.15.2`，本 agent 環境 ExecPlan 因此綁定下一個 Minor `v0.16.0`。
  Evidence: `Get-ChildItem -Path Updates\Main -Recurse -Filter *.md` 顯示最新既有版本為 `Updates\Main\v0\v0.15\v0.15.2.md`；`node tools\updatelog\cli.js new --category main --version 0.16.0 ...` 生成 `Updates/Main/v0/v0.16/v0.16.0.md`。
- Observation: 版本治理規則本身是在此 ExecPlan 首次完整修改後追加，依新規則應以 Patch 形式記錄。
  Evidence: `node tools\updatelog\cli.js new --category main --version 0.16.1 ...` 生成 `Updates/Main/v0/v0.16/v0.16.1.md`。

## Decision Log

- Decision: 本輪保持純文件變更，產物限定為 `AGENTS.md`、`.agent/PLANS.md`、`.agent/reports/*.md` 與本 ExecPlan。
  Rationale: 使用者明確禁止本輪修改 production code、`src` 與 `tests`。
  Date/Author: 2026-05-16 / Codex
- Decision: 將 `src/systemPlugins` 與 `src/skillPlugins` 視為實際插件 scope。
  Rationale: 使用者要求處理實際專案結構下的 `systemPlugins/` 與 `skillPlugins/`；目錄檢查確認它們位於 `src/` 下。
  Date/Author: 2026-05-16 / Codex
- Decision: subagents 僅用於範圍限定偵察與報告撰寫。
  Rationale: 使用者要求 subagents 只能唯讀指定範圍，除了各自報告輸出外不得寫入，並由主 agent 完成最終彙整。
  Date/Author: 2026-05-16 / Codex
- Decision: 在最終彙整 `AGENTS.md` 前先建立 `.agent/PLANS.md`，並讓本 ExecPlan 受該本地計畫規範約束。
  Rationale: 使用者澄清 `.agent/PLANS.md` 必須先建立，且需忠實對齊 OpenAI Codex ExecPlan guide，後續進度才應依其推進。
  Date/Author: 2026-05-16 / Codex
- Decision: `AGENTS.md` 保持英文，`.agent/PLANS.md` 與報告使用繁體中文。
  Rationale: 既有 root `AGENTS.md` 是英文且主要供 coding agents 消費；使用者明確要求 `.agent/PLANS.md` 使用繁體中文，而 subagent 報告也屬於本次中文工作流。
  Date/Author: 2026-05-16 / Codex
- Decision: 本輪不執行 `yarn test`、`yarn build` 或 `yarn lint`。
  Rationale: 完成的工作僅是文件與 agent 報告產出，且使用者明確禁止修改 production code、`src` 與 `tests`。以檔案清單與 git status 驗證足以涵蓋本輪範圍。
  Date/Author: 2026-05-16 / Codex
- Decision: 將本 active ExecPlan 內容改為繁體中文，但保留 section 名稱、路徑、命令與證據格式。
  Rationale: 使用者在 2026-05-17 要求將本次 active ExecPlan 內文改成中文；保留 section 名稱與命令格式可維持 `.agent/PLANS.md` 的可讀性與工具友善性。
  Date/Author: 2026-05-17 / Codex
- Decision: 將七份 `.agent/reports/*.md` 的內容內嵌歸檔到本 ExecPlan，並刪除 `.agent/reports` 暫存目錄。
  Rationale: 使用者要求「將 reports 中的東西全部放進 ExecPlan 中，然後把 reports 的暫存刪除」。內嵌後，本 ExecPlan 成為完整自足的單一來源；刪除暫存目錄可避免後續 agent 誤以為報告仍是分散來源。
  Date/Author: 2026-05-17 / Codex
- Decision: 將 root `AGENTS.md` 改寫為繁體中文，並同步調整其中對 reconnaissance reports 的說明。
  Rationale: 使用者要求「把 AGENTS.md 修改為中文」。因 `.agent/reports` 已被歸檔並刪除，`AGENTS.md` 不應再把 `.agent/reports/` 描述為長期真相來源，而應說明它只可暫存、長期保存應歸檔到 ExecPlan。
  Date/Author: 2026-05-17 / Codex
- Decision: 將本 ExecPlan 綁定 `Target Version: v0.16.0`，並建立 Main UpdateLog `0.16.0`。
  Rationale: 使用者指定新的、被接受的 ExecPlan 代表新的 Minor，且每次更新必須反映在 `Updates/Main`。現有最新 Main UpdateLog 是 `0.15.2`，因此此 agent 環境 ExecPlan 使用下一個 Minor `0.16.0`。
  Date/Author: 2026-05-17 / Codex
- Decision: 把版本與 UpdateLog 規則同時寫入 `AGENTS.md` 與 `.agent/PLANS.md`。
  Rationale: `AGENTS.md` 是 agent 進入 repository 的操作指南，`.agent/PLANS.md` 是 ExecPlan 的規範來源；版本規則同時影響一般更新與 ExecPlan 工作流，兩處都需要明確規定。
  Date/Author: 2026-05-17 / Codex
- Decision: 為本次版本治理補強建立 `v0.16.1` Patch UpdateLog。
  Rationale: 依使用者的新規則，同一份 ExecPlan 首次完整修改後的補充任務應增加 Patch；版本治理規則是在本 active ExecPlan 後續追加，因此除了 `v0.16.0` 目標版本紀錄外，也需要 `v0.16.1` 記錄此補充。
  Date/Author: 2026-05-17 / Codex

## Outcomes & Retrospective

repository agent environment 更新已完成。repository 現在有一份以報告為依據的 root `AGENTS.md`、一份對齊 OpenAI Codex ExecPlan guide 的繁體中文 `.agent/PLANS.md`、七份已歸檔於本 ExecPlan 的範圍報告，以及位於 `plans/active/` 的本 living plan。

本輪沒有修改 production code、`src/` 或 `tests/` 檔案。執行期間的主要修正是順序問題：`.agent/PLANS.md` 必須在最終彙整前建立，因此已提前加入，並更新本 ExecPlan 以引用該規範。剩餘缺口是產生的文件尚未 stage 或 commit；這不在本輪要求範圍內。

2026-05-17 已再依使用者要求將本 active ExecPlan 內文改寫為繁體中文。此變更仍是文件-only，未改 production code。

2026-05-17 追加完成報告歸檔：原 `.agent/reports/*.md` 七份報告內容已全部移入本 ExecPlan 的 `Archived Reconnaissance Reports` section，並刪除 `.agent/reports` 暫存目錄。後續需要讀取偵察結果時，直接查閱本 ExecPlan，不再依賴外部分散報告檔。

2026-05-17 追加完成 `AGENTS.md` 中文化：root `AGENTS.md` 已改為繁體中文，保留原 repository 規則與結構，並將 documentation trust order 裡的 reports 說明改成 active ExecPlan archived reconnaissance reports。

2026-05-17 追加完成版本與 UpdateLog 規則：本 ExecPlan 綁定 `Target Version: v0.16.0`，新增 `Updates/Main/v0/v0.16/v0.16.0.md` 作為此 ExecPlan 的 Minor 紀錄，另新增 `Updates/Main/v0/v0.16/v0.16.1.md` 作為版本治理補強的 Patch 紀錄。`AGENTS.md` 與 `.agent/PLANS.md` 已明確規定每次更新都必須建立或更新 `Updates/Main`，Major 只能由專案管理員提升，Minor 跟隨新的 ExecPlan，Patch 跟隨同一 ExecPlan 的後續補充任務。

## Context and Orientation

這是一個位於 `E:\ai-training\demonkernel` 的 TypeScript Node 專案。runtime code 位於 `src/`，測試位於 `tests/`，正式文件位於 `docs/`，更新歷史位於 `Updates/`，工具位於 `tools/`。本任務不是 implementation change；它建立並更新 agent-facing documentation，讓後續工作可以用更好的脈絡進行規劃、執行與維護。

ExecPlan 是 living execution plan：一份自足的 Markdown 文件，用來說明變更為何重要、如何完成、如何驗證，以及執行過程做了哪些決策。計畫必須足以讓新手或無狀態 agent 只靠 repository 與該計畫檔案重新開始工作。

## Plan of Work

首先，建立指定的 `.agent/reports/` 與 `plans/active/` 目錄。接著建立 `.agent/PLANS.md` 作為本地 ExecPlan 規則來源，然後在該規則下建立並維護本 ExecPlan。之後派出六個 subagents，每個都受限於單一讀取範圍與單一報告輸出檔。當六份報告完成後，再從前六份報告與選定根目錄檔案產生第七份 repository architecture report。最後，將報告彙整進 root `AGENTS.md`，並以證據與回顧更新本 ExecPlan。

主 agent 負責 `AGENTS.md`、`.agent/PLANS.md` 與 `plans/active/repository-agent-environment.exec.md` 的最終編輯。Subagents 只負責它們各自指定的 `.agent/reports/` 報告檔。

2026-05-17 的追加工作只修改本 active ExecPlan：將英文敘述改寫為繁體中文，並保留原有計畫內容、路徑、命令、報告清單、決策與驗證資訊。

2026-05-17 的第二項追加工作把 `.agent/reports` 的全部報告內容併入本 ExecPlan。合併時保留報告文字，並將報告內 heading 降兩級，使其位於 `Archived Reconnaissance Reports` 下而不破壞 ExecPlan 主結構。

2026-05-17 的第三項追加工作只修改 root `AGENTS.md` 與本 ExecPlan：先將 `AGENTS.md` 從英文改為繁體中文，再把這次文件更新記錄回本 ExecPlan。沒有修改 production code、`src/` 或 `tests/`。

2026-05-17 的第四項追加工作加入版本治理：先用 UpdateLog CLI 建立 Main 更新紀錄，再更新 `AGENTS.md`、`.agent/PLANS.md` 與本 ExecPlan。依新規則再次檢查後，補建 `v0.16.1` Patch 紀錄，讓版本治理補強本身也反映在 `Updates/Main`。此工作仍是文件與規範層變更，不修改 runtime code。

## Concrete Steps

所有命令都從 `E:\ai-training\demonkernel` 執行。

建立必要目錄：

    New-Item -ItemType Directory -Force -Path .agent,.agent\reports,plans\active

建立初始 ExecPlan：

    apply_patch adds plans/active/repository-agent-environment.exec.md

派出六個範圍限定偵察 subagents。每個 subagent 只能讀取指定 scope，且只能在 `.agent/reports/` 寫入它被指定的報告。

報告完成後，彙整 `.agent/reports/repository-architecture-report.md`，接著更新 `AGENTS.md` 並更新本檔案。

最終驗證：

    git status --short
    ?? .agent/
    ?? AGENTS.md
    ?? plans/

產生的報告清單：

    core-report.md
    docs-report.md
    plugins-report.md
    repository-architecture-report.md
    tests-report.md
    tooling-readmes-report.md
    updates-report.md

2026-05-17 追加翻譯步驟：

    Get-Content -Path plans\active\repository-agent-environment.exec.md
    apply_patch replaces plans/active/repository-agent-environment.exec.md with Traditional Chinese content

2026-05-17 報告歸檔與暫存刪除步驟：

    Select-String -Path plans\active\repository-agent-environment.exec.md -Pattern 'Archived Reconnaissance Reports','Archived Report:'
    $root = (Resolve-Path '.').Path
    $target = (Resolve-Path '.agent\reports').Path
    if (-not $target.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar)) { throw "Refusing to delete outside workspace: $target" }
    Remove-Item -LiteralPath $target -Recurse -Force

2026-05-17 `AGENTS.md` 中文化步驟：

    Get-Content -Path AGENTS.md
    apply_patch replaces AGENTS.md with Traditional Chinese content
    Get-Content -Path AGENTS.md | Select-Object -First 40

2026-05-17 版本與 UpdateLog 規則步驟：

    Get-ChildItem -Path Updates\Main -Recurse -Filter *.md
    node tools\updatelog\cli.js new --category main --version 0.16.0 ...
    node tools\updatelog\cli.js new --category main --version 0.16.1 ...
    apply_patch updates AGENTS.md with UpdateLog and version rules
    apply_patch updates .agent/PLANS.md with Target Version and UpdateLog rules
    apply_patch adds Target Version: v0.16.0 to this ExecPlan

## Validation and Acceptance

這是 documentation-only change。原始驗收要求七份 `.agent/reports/*.md` 報告存在；2026-05-17 使用者改為要求將報告內容全部放入本 ExecPlan 並刪除 reports 暫存。因此，當下列檔案與歸檔內容存在時，即符合目前驗收：

- `AGENTS.md`
- `.agent/PLANS.md`
- `plans/active/repository-agent-environment.exec.md`
- `plans/active/repository-agent-environment.exec.md` 內含 `Archived Reconnaissance Reports`
- `Archived Reconnaissance Reports` 內含七個 archived reports：updates、docs、tests、core、plugins、tooling-readmes、repository-architecture
- `.agent/reports` 暫存目錄不存在

執行 `git status --short` 並確認沒有 production code、`src/` 或 `tests/` 檔案被修改。因本輪只修改文件與 agent reports，除非後續 reviewer 需要額外信心證明 runtime behavior 未變，否則不要求執行 project build 或 tests。

本輪驗證已完成：`git status --short` 顯示只有 `.agent/`、`AGENTS.md` 與 `plans/`。未執行 build 或 test，因為沒有 runtime code 變更。

2026-05-17 的中文化追加驗收：本檔案主要敘述已改為繁體中文，並保留 ExecPlan 必要 sections、原始證據、路徑、命令與驗證資訊。

2026-05-17 的報告歸檔追加驗收：本 ExecPlan 包含 `Archived Reconnaissance Reports` section，且包含七個 archived report headings；`.agent/reports` 暫存目錄已刪除。

最終驗證補充：`Test-Path .agent\reports` 回傳 `False`；`Select-String '^### Archived Report:'` 計數為 `7`。`git status --short` 顯示 `.agent/`、`AGENTS.md`、`plans/` 以及 `.gitignore` 修改，其中 `.gitignore` diff 是新增 `.agent/reports/` ignore entry。

2026-05-17 的 `AGENTS.md` 中文化追加驗收：`AGENTS.md` 開頭為 `# Repository 指南`，主要章節與規則已改為繁體中文，且保留 commands、paths、plugin/capability contracts、testing、UpdateLog、security 與 documentation trust order。

2026-05-17 的版本與 UpdateLog 追加驗收：`Updates/Main/v0/v0.16/v0.16.0.md` 與 `Updates/Main/v0/v0.16/v0.16.1.md` 已由 UpdateLog CLI 生成；`AGENTS.md` 與 `.agent/PLANS.md` 均包含「每次更新必須建立或更新 UpdateLog」、「Updates/Main 是全域更新索引」與 Major/Minor/Patch 規則；本 ExecPlan 包含 `Target Version: v0.16.0`。

## Idempotence and Recovery

目錄建立使用 `-Force`，因此可安全重跑。報告產生是在 `.agent/reports/` 內 additive；如果某份報告不完整，只需重新產生該報告檔。若 `AGENTS.md`、`.agent/PLANS.md` 或本 ExecPlan 需要修正，可直接更新該檔案，並在本 ExecPlan 的 `Decision Log` 記錄原因。

將本 ExecPlan 中文化是可重複的文件編輯；若需要回復英文版本，可從 git diff 或歷史版本復原。若只需調整措辭，應維持 section 結構與驗證資訊不變。

UpdateLog 建立是按版本路徑寫入；若 `Updates/Main/v0/v0.16/v0.16.0.md` 已存在且需要重產，必須明確使用 CLI 的 `--force`，並在 `Decision Log` 說明原因。後續同一 ExecPlan 的補充任務不應新建 Minor，應使用 `0.16.x` 的下一個 Patch。

## Artifacts and Notes

`.agent/PLANS.md` 對齊時使用的重要來源：

    https://developers.openai.com/cookbook/articles/codex_exec_plans

重要本機發現：

    Root AGENTS.md exists.
    Plugin directories are src/systemPlugins and src/skillPlugins.

Subagent report 原始產物路徑如下；這些檔案內容已完整歸檔到本 ExecPlan，原 `.agent/reports` 暫存目錄已刪除：

    .agent/reports/updates-report.md
    .agent/reports/docs-report.md
    .agent/reports/tests-report.md
    .agent/reports/core-report.md
    .agent/reports/plugins-report.md
    .agent/reports/tooling-readmes-report.md
    .agent/reports/repository-architecture-report.md

最終變更路徑清單：

    .agent/
    AGENTS.md
    plans/

2026-05-17 追加產物：

    plans/active/repository-agent-environment.exec.md 內文已改為繁體中文。

2026-05-17 報告歸檔產物：

    plans/active/repository-agent-environment.exec.md 包含 Archived Reconnaissance Reports。
    .agent/reports 暫存目錄已刪除。
    Test-Path .agent\reports => False
    Archived Report heading count => 7

2026-05-17 `AGENTS.md` 中文化產物：

    AGENTS.md 已改為繁體中文。
    AGENTS.md Documentation Trust Order 已改為引用 active ExecPlan 中的 archived reconnaissance reports。

2026-05-17 版本與 UpdateLog 產物：

    Updates/Main/v0/v0.16/v0.16.0.md
    Updates/Main/v0/v0.16/v0.16.1.md
    AGENTS.md 包含每次更新必須建立 UpdateLog 與 Major/Minor/Patch 規則。
    .agent/PLANS.md 包含 ExecPlan Target Version 與 UpdateLog 規則。
    plans/active/repository-agent-environment.exec.md 包含 Target Version: v0.16.0。

## Archived Reconnaissance Reports

以下內容是原 `.agent/reports/*.md` 偵察報告的完整歸檔版本。報告已併入本 ExecPlan，原暫存報告檔已刪除；各報告 heading 已降級以保留本 ExecPlan 的主結構。

### Archived Report: updates-report.md

### 更新歷史報告

本報告僅依據 `Updates/` 下的更新紀錄整理，涵蓋 Main 與 system plugins 的版本時間線、重大變更、已棄用設計，以及仍影響目前開發的歷史決策。

#### 一、Main 版本時間線

##### v0.1.0 - 2026-03-01
- 建立 plugins 基本架構，並導入規範化 UpdateLog 工具與說明文件。
- 證據：`Updates/Main/v0/v0.1/v0.1.0.md`

##### v0.2.0 - 2026-03-01
- 完成新版非同步、依賴感知的 `PluginsManager`，以同波並行與 `startupWeight` 控制啟動順序。
- 建立 runtime 狀態機、依賴阻塞、精確版本判定、集中錯誤回收與 startup report。
- 破壞性移除 `priority`、lifecycle Result 失敗回傳、舊單檔 manager、舊 LLM 專屬管理 API。
- 證據：`Updates/Main/v0/v0.2/v0.2.0.md`

##### v0.3.0 - 2026-03-01
- 將 logger 遷移到 `tools/logger` 並模組化，新增 session-based 目錄、文字與 JSON Lines 雙輸出、非同步 tar.gz 壓縮、redaction、serializer、child logger。
- runtime 與 pluginsManager 改用 logger，不再直接使用 `console.*`。
- 證據：`Updates/Main/v0/v0.3/v0.3.0.md`

##### v0.4.0 / v0.4.1 - 2026-03-07
- v0.4.0 改變循環依賴策略：cycle 不再一律阻塞，改以 SCC 與 `startupWeight` 產生 deterministic 啟動順序，cycle 留在 report 供診斷。
- v0.4.1 修正 Husky pre-commit 寫法，移除 v8 以前的棄用模板。
- 證據：`Updates/Main/v0/v0.4/v0.4.0.md`、`Updates/Main/v0/v0.4/v0.4.1.md`

##### v0.5.0 - 2026-03-08
- 新增 `core/capabilities` 描述與驗證機制，manifest 支援 `capabilities.provides`。
- 建立 JSON Schema Lite、capability testCases、contract test、原子化註冊與每個 `PluginsManager` 的 capabilities manager 隔離。
- 重要限制：目前只有 system plugin 可註冊 capability，version 僅作描述用途，未做多版本索引。
- 證據：`Updates/Main/v0/v0.5/v0.5.0.md`

##### v0.6.0 - 2026-03-12
- 新增 Capability Provider Registry，提供 `register/resolve/tryResolve/has/list`，並在 plugin online/offline/restart/discover 期間維護 provider 映射。
- 當時 provider 仍以 `send(input) -> output` 作為能力入口。
- 證據：`Updates/Main/v0/v0.6/v0.6.0.md`

##### v0.7.0 - 2026-03-15
- 將舊 `llamaServer` remote LLMStream 遷移為 `systemPlugins/llm-remote-gateway`。
- 僅保留 OpenAI 相容 remote API，移除 local/server 模式與硬編程參數。
- 證據：`Updates/Main/v0/v0.7/v0.7.0.md`

##### v0.8.0 - 2026-03-15
- 新增 `SecretsManager`，插件必須透過統一接口讀取密鑰，不可直接讀取 `process.env`。
- 新增 guard test 防止插件直接使用環境變數。
- 證據：`Updates/Main/v0/v0.8/v0.8.0.md`

##### v0.9.0 - 2026-03-18
- 新增 Discord system plugin，提供 I/O-only 的 `conversation.stream` 與 `message.send` 能力。
- 不包含 slash commands 或舊 `TalkToDemon` 串接。
- 證據：`Updates/Main/v0/v0.9/v0.9.0.md`

##### v0.10.0 / v0.10.1 / v0.10.2 - 2026-03-21
- v0.10.0 新增 talk-engine，提供 `talk.nostream`、`talk.stream`，並導入 Discord typing、relay FIFO queue。
- v0.10.1 預設啟動流程改為核心三插件順序：`llm-remote-gateway -> discord -> talk-engine`，不再 `onlineAll` 全開。
- v0.10.2 修正 Discord `message.send` this 綁定，解決 relay/fallback 回覆失敗。
- 證據：`Updates/Main/v0/v0.10/v0.10.0.md`、`Updates/Main/v0/v0.10/v0.10.1.md`、`Updates/Main/v0/v0.10/v0.10.2.md`

##### v0.11.0 - 2026-03-22
- capability exposure 重構為 provider-first model：registry resolve 回傳 capability-bound endpoint，不再依賴 plugin-wide `send(action)`。
- system plugin capability schema 升級到 2.0.0。
- 證據：`Updates/Main/v0/v0.11/v0.11.0.md`

##### v0.12.0 / v0.12.1 - 2026-03-22 至 2026-04-12
- v0.12.0 在 talk-engine 內建 Prompt Composer，將提示詞組合從 payload builder 拆出，且維持 capability 契約不變。
- v0.12.1 調整 TypeScript/NodeNext 相容性，移除已棄用 `baseUrl`，改寫 `paths`。
- 證據：`Updates/Main/v0/v0.12/v0.12.0.md`、`Updates/Main/v0/v0.12/v0.12.1.md`

##### v0.13.0 / v0.13.1 / v0.13.2 - 2026-04-12
- v0.13.0 導入 `conversation-history` v1，talk-engine 改為讀取 recent history 並持久化 user/assistant；核心啟動順序調整為 `llm -> discord -> conversation-history -> talk-engine`。
- v0.13.1 修復同 scope 併發 append 遺失訊息與 clear 未刪輪轉檔。
- v0.13.2 修復 HarmonyError 連鎖問題，讓上游 SSE error/empty content 可診斷化，並移除 relay 空白補值送信。
- 證據：`Updates/Main/v0/v0.13/v0.13.0.md`、`Updates/Main/v0/v0.13/v0.13.1.md`、`Updates/Main/v0/v0.13/v0.13.2.md`

##### v0.14.0 / v0.14.1 - 2026-04-12
- v0.14.0 補齊 reasoning 內部鏈路：gateway/talk-engine 分流 reasoning 與可見回覆，避免把思考內容當成最終回覆。
- v0.14.1 修正 NodeNext 測試型別與動態 import 診斷。
- 證據：`Updates/Main/v0/v0.14/v0.14.0.md`、`Updates/Main/v0/v0.14/v0.14.1.md`

##### v0.15.0 / v0.15.1 / v0.15.2 - 2026-04-17 至 2026-04-18
- v0.15.0 在核心啟動、pluginsManager、dependency、lifecycle、四個核心 system plugins 補齊高覆蓋結構化 log。
- v0.15.1 修正 shutdown logger 收斂順序，並移除測試中對 log action 字串的耦合。
- v0.15.2 導入 request-scoped 診斷 ring buffer，raw log 改為異常才導出，降低 streaming 熱路徑延遲與隱私風險。
- 證據：`Updates/Main/v0/v0.15/v0.15.0.md`、`Updates/Main/v0/v0.15/v0.15.1.md`、`Updates/Main/v0/v0.15/v0.15.2.md`

#### 二、System Plugin 版本脈絡

##### llm-remote-gateway
- v0.1.0：新增 OpenAI 相容 remote LLM gateway，提供 chat stream、models list、health check；不包含 local model 或內建 server。證據：`Updates/Plugins/system/llm-remote-gateway/v0/v0.1/v0.1.0.md`
- v1.1.0：配合 Main v0.11.0 遷移為 provider-first，暴露 `streamChat/listModels/checkHealth`。證據：`Updates/Plugins/system/llm-remote-gateway/v1/v1.1/v1.1.0.md`
- v1.1.1：修復 upstream SSE error payload 與 empty-content stream 誤判成功。證據：`Updates/Plugins/system/llm-remote-gateway/v1/v1.1/v1.1.1.md`
- v1.2.0：補齊 reasoning 內部鏈路，將 SSE chunk 分類為 content/reasoning/error，對外 data/end/error/abort 契約維持不變。證據：`Updates/Plugins/system/llm-remote-gateway/v1/v1.2/v1.2.0.md`
- v1.3.0 / v1.3.1：先補齊 request、payload、SSE、health、models 狀態日誌，再改成 request-scoped raw 診斷緩衝與 outcome 導出。證據：`Updates/Plugins/system/llm-remote-gateway/v1/v1.3/v1.3.0.md`、`Updates/Plugins/system/llm-remote-gateway/v1/v1.3/v1.3.1.md`

##### discord
- v0.1.0：新增 Discord I/O-only plugin，提供 inbound stream 與 message send；不遷移 slash commands、TalkToDemon、句子分段回覆。證據：`Updates/Plugins/system/discord/v0/v0.1/v0.1.0.md`
- v0.2.0 / v0.2.1：加入 typing start/stop、reference count、heartbeat，並修正 `channel.send` this 綁定。證據：`Updates/Plugins/system/discord/v0/v0.2/v0.2.0.md`、`Updates/Plugins/system/discord/v0/v0.2/v0.2.1.md`
- v0.3.0：配合 provider-first，改為 `openConversationStream/sendMessage/startTyping/stopTyping`。證據：`Updates/Plugins/system/discord/v0/v0.3/v0.3.0.md`
- v0.4.0 / v0.4.1：補齊 inbound、send、typing、lifecycle 狀態日誌，再改成摘要節點與 raw 緩衝分流。證據：`Updates/Plugins/system/discord/v0/v0.4/v0.4.0.md`、`Updates/Plugins/system/discord/v0/v0.4/v0.4.1.md`

##### talk-engine
- v0.1.0：新增可重用對話引擎，包含 no-stream、stream、relay queue、Discord typing 整合；第一版為單輪無歷史。證據：`Updates/Plugins/system/talk-engine/v0/v0.1/v0.1.0.md`
- v0.2.0：遷移為 provider-first，使用 `generateReply/streamReply`，並直接呼叫 dependency provider methods。證據：`Updates/Plugins/system/talk-engine/v0/v0.2/v0.2.0.md`
- v0.3.0：Prompt Composer 內建於 talk-engine，不拆成獨立 plugin。證據：`Updates/Plugins/system/talk-engine/v0/v0.3/v0.3.0.md`
- v0.4.0 / v0.4.1 / v0.4.2：整合 conversation-history、同步依賴版本、修復空回覆與 relay 空訊息送信問題。證據：`Updates/Plugins/system/talk-engine/v0/v0.4/v0.4.0.md`、`Updates/Plugins/system/talk-engine/v0/v0.4/v0.4.1.md`、`Updates/Plugins/system/talk-engine/v0/v0.4/v0.4.2.md`
- v0.5.0：新增 reasoning tracker，stream/no-stream 都只對外輸出可見 content，reasoning 僅作內部診斷。證據：`Updates/Plugins/system/talk-engine/v0/v0.5/v0.5.0.md`
- v0.6.0 / v0.6.1：補齊高覆蓋狀態日誌，之後將 raw 細節改到 request 診斷緩衝。證據：`Updates/Plugins/system/talk-engine/v0/v0.6/v0.6.0.md`、`Updates/Plugins/system/talk-engine/v0/v0.6/v0.6.1.md`

##### conversation-history
- v1.0.0：新增 v1 transcript store，提供 append/recent/clear，包含 JSON 檔案儲存、快取、裁剪與輪轉備份；明確不含 summary/facts/episodic memory/vector retrieval。證據：`Updates/Plugins/system/conversation-history/v1/v1.0/v1.0.0.md`
- v1.0.1：修復同 scope 併發寫入與 clear 輪轉檔殘留問題。證據：`Updates/Plugins/system/conversation-history/v1/v1.0/v1.0.1.md`
- v1.1.0 / v1.1.1：補齊 scope/cache/prune/IO 日誌，再導入 request 關聯與 raw 緩衝，避免歷史內容常態完整落盤。證據：`Updates/Plugins/system/conversation-history/v1/v1.1/v1.1.0.md`、`Updates/Plugins/system/conversation-history/v1/v1.1/v1.1.1.md`

#### 三、已棄用或被取代的設計

- `runtime.priority` 已被 `startupWeight` 取代，且 lifecycle 不再回傳 Result 失敗狀態，改為 throw-only，由 manager 集中處理。證據：`Updates/Main/v0/v0.2/v0.2.0.md`
- 舊版 PluginsManager 單檔案實作、舊 LLM 專屬管理 API 已移除。證據：`Updates/Main/v0/v0.2/v0.2.0.md`
- cycle 一律 blocked 的依賴策略已被 SCC + `startupWeight` 取代；cycle 現在可存在但需設計啟動順序與延遲初始化。證據：`Updates/Main/v0/v0.4/v0.4.0.md`
- 直接 `console.*` 紀錄被統一 logger 取代。證據：`Updates/Main/v0/v0.3/v0.3.0.md`
- 舊 `llamaServer` local/server 模式與硬編程 LLM 參數沒有被遷移到新 gateway。證據：`Updates/Main/v0/v0.7/v0.7.0.md`
- 插件直接讀取 `process.env` 被 SecretsManager 規範取代。證據：`Updates/Main/v0/v0.8/v0.8.0.md`
- Discord slash commands、舊 `TalkToDemon` 與句子分段回覆未納入新 Discord plugin。證據：`Updates/Plugins/system/discord/v0/v0.1/v0.1.0.md`
- capability 透過 `send(action)` multiplex 的模式在 v0.11.0 轉為 provider-first methods。證據：`Updates/Main/v0/v0.11/v0.11.0.md`
- Prompt Composer 不作為獨立 plugin，而是內建於 talk-engine。證據：`Updates/Plugins/system/talk-engine/v0/v0.3/v0.3.0.md`
- relay 空白補值送信與 reasoning-only 視為可見輸出的行為已移除。證據：`Updates/Main/v0/v0.13/v0.13.2.md`、`Updates/Main/v0/v0.14/v0.14.0.md`
- streaming 熱路徑完整 raw 內容常態落盤已改為 request-scoped raw 緩衝，異常才導出。證據：`Updates/Main/v0/v0.15/v0.15.2.md`
- TypeScript `baseUrl` 設定已因 TS 7.0 相容性移除，改以 NodeNext 與調整後的 paths。證據：`Updates/Main/v0/v0.12/v0.12.1.md`

#### 四、仍影響目前開發的歷史決策

- 插件生命週期必須配合 `PluginsManager` 的 dependency-first 模型、精確版本依賴、`startupWeight`、throw-only lifecycle 與 runtime 狀態機；新增或修改 plugin 時需同步更新 manifest 與依賴版本。證據：`Updates/Main/v0/v0.2/v0.2.0.md`
- 循環依賴不是自動錯誤，但會進入 report；互依 plugin 應透過 `startupWeight`、延遲初始化或 provider resolve 時機避免競態。證據：`Updates/Main/v0/v0.4/v0.4.0.md`
- capability 描述、provider registry 與實際 provider 生命週期是分層設計；描述由 capabilities manager 驗證，provider 映射只代表目前 online plugin。證據：`Updates/Main/v0/v0.5/v0.5.0.md`、`Updates/Main/v0/v0.6/v0.6.0.md`
- 目前 capability 呼叫應採 provider-first method，不應新增依賴 action discriminator 的共用 `send(action)` 路由。證據：`Updates/Main/v0/v0.11/v0.11.0.md`
- system plugin 的密鑰存取必須走 SecretsManager，並有測試守門避免直接 `process.env`。證據：`Updates/Main/v0/v0.8/v0.8.0.md`
- 核心對話鏈的啟動順序歷史上已固定到 `llm-remote-gateway -> discord -> conversation-history -> talk-engine`，conversation-history 不可用時 talk-engine scope 模式會退回無歷史路徑，這會影響上下文品質。證據：`Updates/Main/v0/v0.13/v0.13.0.md`
- conversation-history v1 是純 transcript store，不包含摘要、facts、episodic memory 或 vector retrieval；若要新增記憶層，需要另定能力邊界。證據：`Updates/Plugins/system/conversation-history/v1/v1.0/v1.0.0.md`
- LLM gateway 的公開定位是 OpenAI 相容 remote gateway；local model/server 能力不在目前架構內。證據：`Updates/Plugins/system/llm-remote-gateway/v0/v0.1/v0.1.0.md`
- reasoning 應被視為內部診斷訊號，不應污染可見回覆、assistant history 或外部 stream content。證據：`Updates/Plugins/system/talk-engine/v0/v0.5/v0.5.0.md`
- logger/observability 目前採摘要節點與 request-scoped raw 緩衝；新增高頻路徑時應避免完整 payload/content 常態落盤，並注意 `requestId`、`outcome` 與敏感資料遮罩。證據：`Updates/Main/v0/v0.15/v0.15.2.md`
- 測試應避免直接耦合 log action 字串；若要驗證觀測契約，應設計專用測試。證據：`Updates/Main/v0/v0.15/v0.15.1.md`



### Archived Report: docs-report.md

### Demonkernel 文件導讀報告

#### 範圍與限制

- 本報告依使用者限制，只讀取 `docs/` 內正式文件，另讀取最小根目錄 metadata：`package.json`、`tsconfig.json`，用於確認專案設定。
- 未讀取 `src/`、`tests/`、`tools/`、`Updates/` 或其他實作檔；因此本文對「實作是否完全符合文件」只做文件可信度評估，不做程式碼驗證。
- 寫入檔案僅有本報告：`.agent/reports/docs-report.md`。

#### 文件地圖

正式文件入口是 `docs/README.md`，其索引將文件分成 Logger、Plugins / PluginsManager、Capabilities、Registry、Secrets、UpdateLog 六組。依此索引，目前文件涵蓋：

- Logger：`docs/logger/overview.md`、`docs/logger/api-reference.md`、`docs/logger/integration-tools-plugins-manager.md`、`docs/logger/migration-from-legacy.md`、`docs/logger/operations.md`
- Plugins / PluginsManager：`docs/plugins/overview.md`、`docs/plugins/plugin-sdk.md`、`docs/plugins/example-skill.md`、`docs/pluginsManager/overview.md`、`docs/pluginsManager/migration.md`、`docs/pluginsManager/plugin-manifest-schema.md`
- Capabilities：`docs/capabilities/overview.md`、`docs/capabilities/usage.md`、`docs/capabilities/schema.md`
- Registry：`docs/registry/overview.md`
- Secrets：`docs/secrets/overview.md`、`docs/secrets/usage.md`
- UpdateLog：`docs/updatelog-spec.md`

#### 專案設定摘要

- 專案是 TypeScript Node 專案，套件名稱 `demonkernel`、版本 `0.15.2`、MIT 授權；證據：`package.json`。
- 主要指令使用 Yarn：
  - `yarn dev`：以 `ts-node src/index.ts` 啟動開發模式。
  - `yarn build`：執行 `tsc -p tsconfig.json`、`tsc-alias`，再複製 plugin manifests/assets 到 `dist`。
  - `yarn start`：先 build，再跑 `node dist/index.js`。
  - `yarn test`：Vitest globals。
  - `yarn lint`：ESLint 全專案。
  - `yarn updatelog:*`：包裝 `tools/updatelog/cli.js` 的 new / ensure / validate 流程。
  證據：`package.json`。
- TypeScript 設定為 `target: ES2022`、`module: NodeNext`、`moduleResolution: NodeNext`、`strict: true`，輸出至 `dist`，原始碼根目錄為 `src`；`@core/*` path alias 指向 `./src/core/*`。證據：`tsconfig.json`。
- 主要 runtime / dev 依賴包含 `discord.js`、`dotenv`、`axios`、`tar`、`typescript`、`vitest`、`eslint`、`ts-node`、`tsc-alias`、`cpy-cli`。證據：`package.json`。

#### 架構總覽

Demonkernel 文件描述的是一個以插件為核心的 Node/TypeScript runtime。整體結構可由以下幾個核心模組理解：

1. `pluginsManager` 管理 skill/system 插件生命週期、依賴排序、manifest 驗證與 capability provider 綁定。證據：`docs/plugins/overview.md`、`docs/pluginsManager/overview.md`。
2. `plugin-sdk` 定義插件 manifest、型別、lifecycle 契約與驗證工具。證據：`docs/plugins/plugin-sdk.md`、`docs/pluginsManager/plugin-manifest-schema.md`。
3. `capabilities` 負責能力描述的登錄、驗證、查詢，不負責執行能力或路由。證據：`docs/capabilities/overview.md`、`docs/capabilities/usage.md`。
4. `registry` 負責 capability id 到 provider instance 的映射與解析，回傳 capability 專屬 provider methods。證據：`docs/registry/overview.md`。
5. `logger` 提供結構化 JSON Lines、人讀 log、session 化輸出、redaction、request-scoped raw diagnostics。證據：`docs/logger/overview.md`、`docs/logger/api-reference.md`、`docs/logger/operations.md`。
6. `secrets` 集中處理密鑰讀取，固定優先序為 `process.env > .env`。證據：`docs/secrets/overview.md`、`docs/secrets/usage.md`。
7. `UpdateLog` 規範要求行為變更搭配結構化更新記錄，並透過 CLI / Git hook 驗證。證據：`docs/updatelog-spec.md`、`package.json`。

#### 模組目的與重點

##### Plugins / Plugin SDK

- 插件分成 `skill` 與 `system`，目錄在文件中描述為 `src/skillPlugins`、`src/systemPlugins`，核心支援位於 `src/core/plugin-sdk` 與 `src/core/pluginsManager`。證據：`docs/plugins/overview.md`。
- 每個插件至少需要 `plugin.manifest.json` 與入口檔，manifest 需提供 `meta.name/version/type/entry`、`runtime.startupWeight`、`runtime.method`、`runtime.onlineOptions.oneOf`、精確版本 dependencies。證據：`docs/plugins/overview.md`、`docs/pluginsManager/plugin-manifest-schema.md`。
- lifecycle 採 throw-only 契約：`online/offline/restart/send` 等失敗時直接 throw，不回傳 `{ ok: false }`；manager 負責捕捉與更新 runtime 狀態。證據：`docs/plugins/plugin-sdk.md`、`docs/plugins/overview.md`。
- `send()` 被保留為 plugin-level 入口；capability routing 改由 `getCapabilityBindings()` 提供 capability 專屬 provider methods。證據：`docs/plugins/plugin-sdk.md`、`docs/registry/overview.md`。

##### PluginsManager

- PluginsManager 的能力包括掃描 `dist/skillPlugins` 與 `dist/systemPlugins`、驗證 manifest 與 entry、以 `type:name` 建立唯一鍵、依賴感知非同步波次上線、統一處理 lifecycle throw。證據：`docs/plugins/overview.md`、`docs/pluginsManager/overview.md`。
- 啟動排程依賴版本必須精確相符；依賴缺失或依賴啟動失敗會導致依賴方失敗。循環依賴 SCC 以 `startupWeight` 分波，同權重同波並行。證據：`docs/pluginsManager/overview.md`、`docs/pluginsManager/migration.md`。
- 管理器提供查詢與診斷 API：`getRegistrySnapshot()`、`getInvalidPlugins()`、`getRuntimeStatus()`、`getStartupReport()`。證據：`docs/pluginsManager/overview.md`。
- 遷移文件明確列出舊版 `pluginsManager.js` 到新版的破壞性變更，例如 `priority -> startupWeight`、移除 LLM 專屬 API、移除 `expressApp` 注入責任。證據：`docs/pluginsManager/migration.md`。

##### Capabilities

- `core/capabilities` 是 system 插件能力描述的統一規範器，負責記錄、驗證、查詢能力描述。證據：`docs/capabilities/overview.md`。
- 只有 `meta.type = "system"` 的插件可宣告 `capabilities`；能力 ID 全域唯一；字串引用預設能力 ID 時，不存在會讓插件 invalid；同 ID 不同內容視為衝突。證據：`docs/capabilities/overview.md`。
- manifest 的 `capabilities.provides` 可混合使用字串能力 ID 與完整能力定義物件。證據：`docs/capabilities/usage.md`、`docs/pluginsManager/plugin-manifest-schema.md`。
- 能力表是資料導向 schema，描述 input/output，而非函式清單；欄位包含 `id`、`displayName`、`description`、`version`、`input`、`output`，可選 `testCases`。證據：`docs/capabilities/schema.md`。

##### Registry

- `core/registry` 維護 capability id 到 provider instance 的映射，提供 `register`、`resolve`、`tryResolve`、`has`、`list`。證據：`docs/registry/overview.md`。
- Registry 不負責 `send()` 代理、業務流程、retry/fallback/routing、tool decision 或 chat orchestration。證據：`docs/registry/overview.md`。
- Registry 與 CapabilitiesManager 的邊界清楚：前者處理 provider mapping，後者處理 capability definition。註冊時 capability id 必須已存在於 CapabilitiesManager。證據：`docs/registry/overview.md`。

##### Logger

- Logger 適用於 `src` 執行流程、`pluginsManager`、example plugins、其他 Node.js 腳本；`tools/updatelog` 互動式 CLI 輸出仍維持 `console.*`。證據：`docs/logger/overview.md`、`docs/logger/integration-tools-plugins-manager.md`。
- 日誌設計目標包含 level gate、child logger、結構化 JSON、多 transport、session 目錄、`.log` + `.json` 雙輸出、舊 session 背景壓縮、敏感資訊遮罩。證據：`docs/logger/overview.md`。
- 輸出根目錄是 `logs/`，每次啟動建立 `<ISO datetime>-<pid>` session，分成 `log/<logger-name>.log` 與 `json/<logger-name>.json`。證據：`docs/logger/overview.md`、`docs/logger/operations.md`。
- Observability 契約為 `kind=node` 正常落盤、`kind=raw` 預設進 request ring buffer；`error|abort|timeout` 導出 raw trace，`success` 清理 buffer。證據：`docs/logger/overview.md`、`docs/logger/api-reference.md`、`docs/logger/operations.md`。
- TypeScript wrapper 提供 `configureKernelLogger`、`createKernelLogger`、`flushKernelLogs`、`shutdownKernelLogger`。證據：`docs/logger/api-reference.md`。

##### Secrets

- `core/secrets` 是密鑰存取入口，支援以 schema id 或 env 變數名查詢。證據：`docs/secrets/overview.md`。
- 讀值優先序固定為 `process.env > .env`。證據：`docs/secrets/overview.md`、`docs/secrets/usage.md`。
- `get(key)` 對 unknown key 或缺值 throw；`tryGet(key)` 對 unknown key throw、缺值回 `null`；`has(key)` 對 unknown key throw、缺值回 `false`。證據：`docs/secrets/overview.md`。
- 插件不得直接讀 `process.env` 或根目錄 `.env`，應統一透過 `@core/secrets`。證據：`docs/secrets/overview.md`。

##### UpdateLog

- UpdateLog 要求 Main 與 Plugin 更新遵守固定路徑與 Markdown 章節。Main 路徑格式是 `Updates/Main/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md`；Plugin 路徑格式是 `Updates/Plugins/{skill|system}/{plugin-name}/v{major}/v{major}.{minor}/v{major}.{minor}.{patch}.md`。證據：`docs/updatelog-spec.md`。
- 版本只接受嚴格 `x.y.z` 三段整數，不接受 `v1.0.1` 或 prerelease。證據：`docs/updatelog-spec.md`。
- 必填章節包括 Metadata、Summary、Changes、Impact、Tests、Risks & Rollback、Notes；`Changes` 固定包含 Added / Changed / Fixed / Removed。證據：`docs/updatelog-spec.md`。
- `package.json` 內的 `updatelog:new`、`updatelog:ensure`、`updatelog:validate:*` scripts 與文件的 CLI 說明一致。證據：`docs/updatelog-spec.md`、`package.json`。

#### 文件可信度評估

- 高可信：`docs/README.md` 作為正式文件索引，列出的文件與實際 `docs/` 盤點一致。
- 高可信：專案設定相關文件與 root metadata 大致互相印證。`package.json` 的 build/test/lint/updatelog 指令支援 `docs/updatelog-spec.md` 與插件資產複製描述；`tsconfig.json` 支援文件中多處 `@core/*` import 範例。
- 高可信：PluginsManager / Plugin SDK / Registry / Capabilities 多份文件對核心方向一致，尤其是 throw-only lifecycle、`runtime.startupWeight`、`type:name` 唯一鍵、capability 專屬 provider methods。
- 中高可信：Logger 文件完整度高，包含 overview、API、integration、migration、operations，且多處標示 v0.15.2；`package.json` 版本也是 `0.15.2`，時間上看起來相符。
- 中可信：UpdateLog 文件規範完整，且 `package.json` scripts 符合；但本次限制未允許讀取 `tools/updatelog` 或 `Updates/`，所以 CLI 具體行為未驗證。
- 中可信：插件與 manager 文件多次引用 `src/` 實作路徑與 `dist/` 行為，但本次未讀取實作，只能確認文件內部一致與 root scripts 支援。

#### 可能過時或需要複核的區域

1. Capability test case 的描述可能殘留舊語意。`docs/capabilities/schema.md` 說 `testCases.input` 是送進插件 `send()` 的資料；但 `docs/plugins/plugin-sdk.md`、`docs/registry/overview.md`、`docs/pluginsManager/overview.md` 均強調 capability routing 不再依賴 `provider.send({ action })`，而是 capability-bound provider methods。建議更新 schema 文件，明確說明 test case 是針對 capability provider method 的契約輸入，或保留 `send()` 僅限 plugin-level 測試。
2. Logger migration 文件中 `Original(msg)` 建議改為 `info(msg, { raw: true })`，但其他 logger 文件的 v0.15.2 observability 契約要求 raw 診斷使用 `meta.observability.kind = "raw"`。`docs/logger/migration-from-legacy.md` 可能需要改成新的 observability 寫法，避免誤導遷移者。
3. `docs/pluginsManager/overview.md` 延伸閱讀引用 `src/core/pluginsManager/README.md`，該檔不在正式 `docs/` 索引內。本次限制未讀取 `src/`，因此不確定它是否仍存在或是否與正式文件同步。若此 README 是核心技術文件，建議在 `docs/README.md` 標註其地位或將內容收斂到 `docs/pluginsManager/`。
4. `docs/plugins/example-skill.md` 是以 example plugin 為教學核心；若實際 example plugin 近期更動，該文件最容易變 stale。本次未讀 `src/skillPlugins/example`，建議在修改 example plugin 時同步檢查本文件。
5. `docs/pluginsManager/plugin-manifest-schema.md` 說 `io` 是文件用途，manager 不做強型別驗證；若未來 io schema 參與 capability 或 registry 驗證，這裡需要同步更新。

#### 建議後續檢查

- 若下一輪允許讀取實作，優先比對：
  - `src/core/plugin-sdk/types.ts`、`src/core/plugin-sdk/manifest.ts`
  - `src/core/pluginsManager/index.ts`
  - `src/core/capabilities/*`
  - `src/core/registry/*`
  - `src/core/logger/index.ts`、`tools/logger/*`
  - `src/core/secrets/*`
- 若要提升文件維護性，可建立文件 freshness checklist，針對每次變更 `manifest`、`lifecycle`、`capability binding`、`logger observability`、`updatelog CLI` 時要求同步更新對應文件。



### Archived Report: tests-report.md

### 測試架構報告

#### 範圍與結論

本報告僅依據 `tests/` 目錄與必要根目錄中與測試命令相關的 `package.json`、`tests/tsconfig.json` 觀察撰寫。測試套件以 Vitest 為主，覆蓋核心能力註冊、插件管理、Secrets、內建 system plugins，以及幾個以臨時 fixture plugin 組出的整合路徑。整體測試偏重「插件生命週期與 capability contract 是否正確串接」，外部服務則大多以 mock 或本地 EventEmitter/PassThrough 模擬。

#### 測試框架與命令

- 測試 runner 是 Vitest，`package.json:3` 定義 `yarn test` 執行 `vitest --globals`。
- `tests/tsconfig.json:2-8` 繼承根 `tsconfig.json`，設定 `noEmit`、`rootDir: ".."`，並載入 `node` 與 `vitest/globals` 型別，同時包含 `tests/**/*.ts` 與 `src/**/*.ts`。
- 相關開發命令仍由 Yarn 管理：`yarn lint` 在 `package.json:4`，`yarn build` 在 `package.json:6`。目前未在 `package.json:2-13` 看到 coverage 專用 script。

#### 測試目錄分類

- `tests/capabilities/`
  - `capabilitiesManager.test.ts` 驗證預設 capability 載入、manifest 註冊、system-only 限制、未知 capability 與衝突定義處理，例：immutable snapshot 檢查在 `tests/capabilities/capabilitiesManager.test.ts:38-55`，system plugin 註冊在 `tests/capabilities/capabilitiesManager.test.ts:57-70`。
  - `capability-contract.test.ts` 建立臨時 system plugin，透過 capability 的 testCases、schema validator 與 `PluginsManager.send()` 做 contract 驗證；核心 validation loop 在 `tests/capabilities/capability-contract.test.ts:126-188`。
- `tests/registry/`
  - `capabilityRegistry.test.ts` 驗證 provider 註冊、解析、重複註冊、未知 capability、空 provider 與 metadata list；例如 provider fixture 在 `tests/registry/capabilityRegistry.test.ts:18-21`，重複註冊錯誤在 `tests/registry/capabilityRegistry.test.ts:54-68`。
- `tests/pluginsManager/`
  - `pluginsManager.test.ts` 是最大核心測試，使用臨時 plugin root 與假 plugin manifest/module 測試 discovery、dependency orchestration、startup weight、cycle handling、lifecycle error、capability binding 與 provider 清理；假 plugin 產生器在 `tests/pluginsManager/pluginsManager.test.ts:39-178`。
  - `index.integration.test.ts` 驗證 `src/index` 啟動順序、CLI/env fallback 與 default registry binding；預設四個 system plugin 啟動順序檢查在 `tests/pluginsManager/index.integration.test.ts:18-72`。
  - `discord.integration.test.ts`、`llm-remote-gateway.integration.test.ts`、`talk-engine.integration.test.ts` 以臨時 system plugin 加上實際 manifest 形狀驗證 capability discovery 與 provider 註冊，例如 Discord capability 清單在 `tests/pluginsManager/discord.integration.test.ts:169-183`，LLM gateway 三個 capability 在 `tests/pluginsManager/llm-remote-gateway.integration.test.ts:156-169`，Talk Engine 兩個 capability 在 `tests/pluginsManager/talk-engine.integration.test.ts:522-558`。
- `tests/systemPlugins/`
  - `discord.test.ts` mock `discord.js` Client 與 secrets，測 lifecycle、conversation stream、message.send、typing reference count/heartbeat、action aliases 與錯誤路徑；mock Client 在 `tests/systemPlugins/discord.test.ts:10-67`。
  - `llm-remote-gateway.test.ts` mock axios 與 SSE stream，測 remote lifecycle、chat stream parsing、abort、timeout、`[DONE]` terminal、server_error、parse_error、retry、models/health、payload validator；axios mock 在 `tests/systemPlugins/llm-remote-gateway.test.ts:14-18`，SSE stream fixture 在 `tests/systemPlugins/llm-remote-gateway.test.ts:34-43`。
  - `talk-engine.test.ts` mock capability registry 與 logger，測 no-stream/stream reply、history 注入與持久化、Discord relay flow、fallback reply、FIFO relay；registry/logger mock 在 `tests/systemPlugins/talk-engine.test.ts:16-95`。
  - `conversation-history.test.ts` 以臨時 historyDir 測 append/recent/prune、expire cleanup、file rotation、malformed JSON、concurrent append、clear backups/cache；臨時目錄與 cleanup 在 `tests/systemPlugins/conversation-history.test.ts:34-50`。
  - `talk-engine.prompt-composer.test.ts` 單獨測 prompt content/message composition，包含 sender prefix 與 history prepend，測試項目列於 `tests/systemPlugins/talk-engine.prompt-composer.test.ts:8-54`。
- `tests/secrets/`
  - `secretsManager.test.ts` 以臨時 `.env` 測 schema id/env name lookup、process env 優先、missing/unknown key error code、reload；臨時 env file helper 在 `tests/secrets/secretsManager.test.ts:14-18`。
  - `plugins-no-direct-env.test.ts` 掃描 `src/skillPlugins` 與 `src/systemPlugins` 的 `.ts/.js`，禁止 plugin 直接使用 `process.env`；掃描與 regex 檢查在 `tests/secrets/plugins-no-direct-env.test.ts:37-55`。

#### Fixtures、Mocks 與測試資料策略

- 大量使用 `fs.mkdtempSync(os.tmpdir())` 建立隔離測試根目錄，再在 `afterEach` 以 `fs.rmSync(..., { recursive: true, force: true })` 清除，例如 `tests/pluginsManager/pluginsManager.test.ts:39-47`、`tests/capabilities/capability-contract.test.ts:20-28`、`tests/systemPlugins/conversation-history.test.ts:38-50`。
- Plugin manager 測試直接寫入 `plugin.manifest.json` 與 CommonJS `index.js` fixture，藉由可配置的 `FakePluginOptions` 模擬 online/offline/restart/send/state throw、啟動延遲、capability binding 缺失或錯誤 provider，見 `tests/pluginsManager/pluginsManager.test.ts:14-37` 與 `tests/pluginsManager/pluginsManager.test.ts:114-177`。
- System plugin 單元測試多用 Vitest mock：
  - Discord mock `discord.js` Client、GatewayIntentBits、Partials，並攔截 secretsManager `get/tryGet`，見 `tests/systemPlugins/discord.test.ts:63-67` 與 `tests/systemPlugins/discord.test.ts:113-130`。
  - LLM gateway mock `axios`，用 `PassThrough` 模擬 SSE，見 `tests/systemPlugins/llm-remote-gateway.test.ts:14-18` 與 `tests/systemPlugins/llm-remote-gateway.test.ts:34-43`。
  - Talk Engine mock core registry/logger，以 in-memory provider map 驅動 cross-capability 行為，見 `tests/systemPlugins/talk-engine.test.ts:16-95`。
- 整合測試偏向「manifest + fixture module」模式：例如 Discord/LLM/Talk Engine integration 會讀 system plugin manifest、把 entry 改成本地 fixture `index.js`，再用 `PluginsManager` discovery/online 驗證 provider 註冊，見 `tests/pluginsManager/discord.integration.test.ts:30-47`、`tests/pluginsManager/llm-remote-gateway.integration.test.ts:30-45`、`tests/pluginsManager/talk-engine.integration.test.ts:420-485`。

#### 核心行為覆蓋

- Capability lifecycle：
  - `CapabilitiesManager` 會載入預設 capability，回傳不可被外部 mutation 影響的 snapshot，並拒絕非 system plugin 或未知 default id，見 `tests/capabilities/capabilitiesManager.test.ts:38-108`。
  - `CapabilityRegistry` 驗證已知 capability id、provider 至少有 callable method、重複註冊與 resolve/tryResolve 行為，見 `tests/registry/capabilityRegistry.test.ts:24-115`。
  - Contract validation 會跑 capability testCases，驗 input/output schema 與 expectedOutput，並能抓出 output schema mismatch，見 `tests/capabilities/capability-contract.test.ts:201-262`。
- PluginsManager orchestration：
  - Discovery 能區分 valid/invalid manifest，包含 startupWeight 欄位驗證，見 `tests/pluginsManager/pluginsManager.test.ts:225-254`。
  - Startup orchestration 覆蓋 startupWeight 排序、同 wave parallel、dependency 已在線/同 queue 等待/不在 queue 立即失敗、dependency startup 失敗、cycle/SCC 情境，測試標題集中在 `tests/pluginsManager/pluginsManager.test.ts:256-625`。
  - Capability provider 註冊、binding 驗證、undeclared capability、createProvider 非 function、空 provider、offline 清理、rediscover 清除 stale mapping、重複 provider 衝突，都在 `tests/pluginsManager/pluginsManager.test.ts:751-1015`。
- System plugin 行為：
  - Discord：lifecycle、缺 token 失敗、mention/reply/owner DM stream、guild channel filter、send success/error、this binding、typing reference count/heartbeat/offline cleanup、action alias，見 `tests/systemPlugins/discord.test.ts:181-540`。
  - LLM remote gateway：SSE chunk 與 reasoning_content、abort、timeout 單次 error、`[DONE]` 提前終止、server_error/parse_error、retry、models.list/health.check、legacy signature、message sanitizer、payload builder，見 `tests/systemPlugins/llm-remote-gateway.test.ts:84-451`。
  - Talk Engine：把 user payload 轉成 LLM gateway messages、history 注入與 append、stream wrapper、reasoning-only chunk 過濾、Discord relay 順序、fallback error reply、FIFO relay，見 `tests/systemPlugins/talk-engine.test.ts:221-573`。
  - Conversation history：local file lifecycle、prune/expire/rotation/malformed JSON/concurrent append/clear backup，見 `tests/systemPlugins/conversation-history.test.ts:52-196`。
- CLI/startup：
  - `run([])` 預設啟動 LLM gateway、Discord、conversation-history、talk-engine，並將 env 轉成 onlineOptions，見 `tests/pluginsManager/index.integration.test.ts:18-72`。
  - 缺 `LLM_REMOTE_BASE_URL` 會 fail fast 且不呼叫 online，見 `tests/pluginsManager/index.integration.test.ts:74-100`。
  - CLI args 覆蓋 env fallback，見 `tests/pluginsManager/index.integration.test.ts:136-176`。
- Secrets 與安全防線：
  - SecretsManager 支援 schema id/env name lookup、process env 優先、missing/unknown error code、reload，見 `tests/secrets/secretsManager.test.ts:33-140`。
  - Plugin source guard 禁止 plugin source 直接使用 `process.env`，見 `tests/secrets/plugins-no-direct-env.test.ts:37-55`。

#### 測試缺口與風險

- 缺少真實外部服務端到端測試。Discord 使用 mock `discord.js` Client，LLM gateway 使用 mock axios/PassThrough SSE，因此無法保證真實 Discord gateway/channel permission、網路 TLS/proxy、實際 OpenAI-compatible API 回應變體都被涵蓋；相關 mock 證據見 `tests/systemPlugins/discord.test.ts:10-67`、`tests/systemPlugins/llm-remote-gateway.test.ts:14-43`。
- 整合測試驗證的是 manifest discovery 與 capability provider binding，但多數 runtime module 是測試內寫出的 fixture `index.js`，不是直接啟動真實 system plugin entry；證據見 `tests/pluginsManager/discord.integration.test.ts:48-90`、`tests/pluginsManager/llm-remote-gateway.integration.test.ts:46-80`、`tests/pluginsManager/talk-engine.integration.test.ts:435-485`。
- 沒有看到 coverage 指令或 coverage threshold。`package.json:2-13` 只列出 test/lint/dev/build/start/updatelog/prepare，未列 coverage script。
- 測試主要集中在 core、systemPlugins、secrets；目前從檔案清單看不到 `tests/skillPlugins/` 類別，因此 skill plugin 行為若有擴張，可能需要補專屬測試。現有 skill plugin 相關防線主要是 source guard 掃描 `src/skillPlugins`，見 `tests/secrets/plugins-no-direct-env.test.ts:39-44`。
- Dependency orchestration 有豐富單元覆蓋，但多以合成 plugin 與時間延遲判斷 parallel/wave 行為，可能仍缺少大量插件、長時間運行、真實檔案系統 race、Windows path 邊界等壓力測試；合成 fixture 與 delay 機制見 `tests/pluginsManager/pluginsManager.test.ts:31-37`、`tests/pluginsManager/pluginsManager.test.ts:114-177`。

#### 建議優先補強

1. 增加 `yarn test:coverage` 或等價 coverage script，並為 core orchestration、systemPlugins 設最低門檻。
2. 為 Discord 與 LLM remote gateway 加小型可選 integration/e2e 測試層，預設 skip，CI 可用 secrets 或本地 mock server 啟用。
3. 若 `src/skillPlugins` 開始承載實際行為，新增 `tests/skillPlugins/`，不要只依賴 source guard。
4. 將目前 capability contract validation helper 抽成測試工具或正式 contract test harness，讓每個 system plugin 的 declared capability testCases 可以一致執行。


### Archived Report: core-report.md

### Core 架構報告

本報告依照限制只閱讀 `src/core/` 與必要根目錄 metadata（`package.json`、`tsconfig.json`）。因此，實際 `src/index.ts` 啟動細節未檢視；下列「啟動流程」是由根目錄 scripts 與 core 內部 API 推導。

#### 範圍與入口線索

- 專案執行入口由 root metadata 顯示：`yarn dev` 執行 `ts-node src/index.ts`，`yarn start` 先 build 再跑 `node dist/index.js`（`package.json:5-8`）。
- TypeScript 採 `NodeNext`、`rootDir: src`、`outDir: dist`，並提供 `@core/* -> ./src/core/*` alias（`tsconfig.json:3-7`, `tsconfig.json:16-18`）。
- core 的主要 singleton export：
  - `src/core/pluginsManager/index.ts:1512-1516` 建立預設 `PluginsManager`，綁定預設 `CapabilityRegistry`。
  - `src/core/capabilities/index.ts:9-11` 建立預設 `CapabilitiesManager`。
  - `src/core/registry/index.ts:9-13` 建立預設 `CapabilityRegistry`，綁定預設 capabilities manager。
  - `src/core/secrets/index.ts:8-10` 建立預設 `SecretsManager`。

#### 啟動流程摘要

1. 外層入口（未讀取 `src/index.ts`）通常會 import core singleton，然後呼叫 `pluginsManager.discoverPlugins()`、`validateDependencies()`、`onlineAll()`；PluginsManager README 也明確列出這三步（`src/core/pluginsManager/README.md`）。
2. `PluginsManager` 建構時決定 plugin 路徑、logger、capabilities manager 與 capability registry；若外部同時注入 registry 與 manager，會要求兩者綁定同一個 manager，否則丟 `MANIFEST_INVALID`（`src/core/pluginsManager/index.ts:245-279`）。
3. 預設 plugin 路徑由 `__dirname` 往上兩層解析到 `skillPlugins`、`systemPlugins`；在 ts-node/dev 與 dist/build 下會隨 `__dirname` 分別落在 `src` 或 `dist` 樹（`src/core/pluginsManager/registry.ts:191-199`）。
4. `discoverPlugins()` 會清空 registry、invalid registry、capability registry，重置 capabilities manager，分別掃描 skill/system plugin，並重建 runtime/handle cache；system plugin 掃描時會把 manifest 的 capability 宣告註冊到 capabilities manager（`src/core/pluginsManager/index.ts:282-335`, `src/core/pluginsManager/registry.ts:76-174`）。
5. `validateDependencies()` 是靜態檢查：逐一確認 skill/system dependency 是否存在且版本精確匹配（`src/core/pluginsManager/index.ts:337-385`）。
6. `onlineAll()` 將 registry 全部 key 交給 `onlineMany()`；`onlineMany()` 去重、略過已 online plugin、分析依賴圖與 SCC/cycles，以 wave 啟動 ready plugins；同 wave 依 `startupWeight` 高到低排序後 `Promise.all` 並行啟動（`src/core/pluginsManager/index.ts:497-515`, `src/core/pluginsManager/index.ts:1317-1472`）。
7. 每個 plugin 啟動由 `startPlugin()` 負責：載入 handle、解析 online options、跑 `runOnlineLifecycle()`，成功後註冊 capability providers（`src/core/pluginsManager/index.ts:1246-1315`）。

#### Core Services

- `plugin-sdk` 是外部 plugin 的穩定型別層：定義 `PluginManifest`、`OnlineOptions`、`SendOptions`、`StateCode`、`IPlugin`、`CapabilityBinding` 等（`src/core/plugin-sdk/types.ts:1-153`）。`IPlugin` 必須提供 `online/offline/restart/state/send`，可選 `getCapabilityBindings()`（`src/core/plugin-sdk/types.ts:146-153`）。
- `CapabilitiesManager` 管理 capability definition 目錄，支援 default capability、system plugin manifest 宣告、provider 清單與 snapshot（`src/core/capabilities/manager.ts:19-206`）。只有 system plugin 可透過 manifest 註冊 capabilities（`src/core/capabilities/manager.ts:56-67`）。
- `CapabilityRegistry` 管理 runtime provider instance。它在 register 前確認 capability id 已存在、provider 是物件且至少有一個 callable member、metadata 有 pluginKey 與 ISO datetime（`src/core/registry/manager.ts:38-51`, `src/core/registry/manager.ts:114-165`）。
- `SecretsManager` 從 `process.env` 與 `.env` 載入已知 secret，且優先順序是 `process.env > .env`（`src/core/secrets/manager.ts:62-80`）。接受 env name 或 schema id 查詢（`src/core/secrets/manager.ts:83-101`），目前 schema 包含 Discord 相關 keys（`src/core/secrets/schema/secretKeys.ts:1-7`）。
- `logger` 是 core 到 `tools/logger` 的 façade，提供 configure/create/flush/shutdown；`KernelLogger` 支援 trace/debug/info/warn/error/fatal、child logger、level check（`src/core/logger/index.ts:32-69`）。

#### PluginsManager

- Registry key contract 是 `${PluginType}:${string}`，ref 可用完整 key 或名稱；名稱 ref 若同時命中 skill/system 會被判定 ambiguous（`src/core/pluginsManager/types.ts:14-17`, `src/core/pluginsManager/index.ts:429-495`）。
- Plugin 掃描流程會驗證 `plugin.manifest.json`、manifest type、entry file、duplicate key，並把 manifest 轉成 `PluginDescriptor`（`src/core/pluginsManager/registry.ts:102-164`）。
- Lifecycle module 載入使用 `require(descriptor.entryPath)`，接受 default export 或 commonjs export，並強制檢查五個 lifecycle method（`src/core/pluginsManager/lifecycle.ts:79-112`）。
- Lifecycle 狀態由 manager 維護：`offline | starting | online | stopping | error | blocked`；snapshot 包含 `lastError`、`lastStateCode`、`moduleLoaded`、`onlineMethod`（`src/core/pluginsManager/types.ts:17`, `src/core/pluginsManager/types.ts:53-63`）。
- `online/offline/restart/send/state/offlineAll` 都是 public command surface；每個 command 會產生 requestId、寫入 observability metadata，並把 throw 轉成結果物件而非讓錯誤穿透給呼叫者（`src/core/pluginsManager/index.ts:517-983`）。
- Capability binding 嚴格對齊 manifest 宣告：plugin 有 capabilities 時必須提供 `getCapabilityBindings()`，binding id 不可重複、不可超出宣告、不可少於宣告；provider 建立或註冊失敗會 rollback 該 plugin 的 providers（`src/core/pluginsManager/index.ts:1027-1161`）。

#### Capability Registry 與 Capabilities

- `CapabilitiesManager` 的 default definitions 會在 constructor 驗證後保存，`reset()` 會回復 default definitions 並清空 provider/plugin 對應（`src/core/capabilities/manager.ts:28-54`）。
- manifest 的 `capabilities.provides` 可使用 default capability id 字串，或內嵌完整 `CapabilityDefinition`；字串必須命中 default capability，內嵌 definition 會被完整驗證（`src/core/capabilities/manager.ts:153-180`）。
- 目前內建 default capability 是 `system.echo.message`，定義 input/output schema 與 test cases（`src/core/capabilities/defaults/system.ts:3-58`）。
- `CapabilityRegistry` 一個 capability id 只能註冊一個 provider；`resolve()` 對未知或未註冊 provider 會丟 `CapabilityNotFoundError`，`tryResolve()` 則回傳 `null`（`src/core/registry/manager.ts:38-72`）。
- `removeByPluginInternal()` 與 `clearInternal()` 明確標示只供 PluginsManager 清理使用，屬內部 contract，不應由一般 consumer 直接呼叫（`src/core/registry/manager.ts:87-103`）。

#### Logger、Diagnostics 與 Observability

- Logger options 支援 `diagnosticRingSize`、`diagnosticPreviewChars`、`rawDirectExport`，表示 core 已把診斷緩衝與 raw export 視為 logger runtime 能力，但實作在 `tools/logger`，本次未讀取（`src/core/logger/index.ts:6-10`, `src/core/logger/index.ts:50`）。
- observability request id 可接受外部 `requestId`，否則用 scope、conversation/user/channel seed、timestamp、sequence 組合（`src/core/logger/observability.ts:9-34`）。
- `summarizeUnknown()` 對文字、陣列、物件做 preview/truncation，避免一般 structured log 放入過大的 payload；raw payload 另以 `kind: "raw"` 記錄（`src/core/logger/observability.ts:36-123`, `src/core/pluginsManager/index.ts:210-230`）。
- PluginsManager 在 manager/lifecycle/dependency 階段都把 `stage`、`action`、`requestId`、`eventType`、`outcome` 放入 observability metadata（例如 `src/core/pluginsManager/index.ts:138-230`, `src/core/pluginsManager/lifecycle.ts:21-70`, `src/core/pluginsManager/dependency.ts:16-42`）。

#### Error Handling

- `plugin-sdk` 用 `PluginSdkError` 與 `CoreErrorCode` 表示 manifest/options/method/lifecycle 類錯誤（`src/core/plugin-sdk/errors.ts:3-35`）。
- manifest validation 會拒絕缺少 meta/runtime、`runtime.priority`、非法 method、dependency 空版本、非 system plugin 宣告 capabilities、online options schema 不完整等（`src/core/plugin-sdk/manifest.ts:216-309`）。online options 會依 method schema 驗證，失敗丟 `OPTIONS_INVALID` 或 `METHOD_NOT_ALLOWED`（`src/core/plugin-sdk/manifest.ts:311-343`）。
- PluginsManager 有自己的 error code，涵蓋 plugin ref、manifest、entry、module load、lifecycle contract、dependency、capability binding、online/offline/restart/send/state 失敗（`src/core/pluginsManager/errors.ts:1-22`）。
- lifecycle runner 採 throw-only plugin contract：plugin method 若 throw，manager command catch 後更新 runtime 為 `error`、寫 `lastError`，回傳 `{ ok: false, error }`（`src/core/pluginsManager/index.ts:1474-1509`）。
- dependency evaluation 會把缺依賴、版本不符、依賴已失敗、依賴未在啟動佇列等狀態轉為 failed/waiting/satisfied（`src/core/pluginsManager/dependency.ts:240-386`）；deadlock 會將 pending plugins 標為 `blocked`（`src/core/pluginsManager/index.ts:1416-1430`）。
- Capabilities 與 registry 各有 domain-specific errors：`CapabilitiesError`（invalid declaration/schema/conflict/unsupported type 等）與 `CapabilityNotFoundError`、`CapabilityAlreadyRegisteredError`、`InvalidCapabilityProviderError`（`src/core/capabilities/errors.ts:1-23`, `src/core/registry/errors.ts:1-29`）。
- Secrets 以 `SecretsError` 表示 unknown key、not found、source load failed（`src/core/secrets/errors.ts:1-19`）。

#### Stable Contracts

- Plugin implementer 必須遵守 `IPlugin` lifecycle contract 與 throw-only failure model；`state()` 回傳 `StateResult`，status 僅允許 `0 | 1 | -1 | -2 | -3`（`src/core/plugin-sdk/types.ts:129-153`）。
- Manifest stable fields 包含 `meta.name/version/type/entry`、`runtime.startupWeight/method/onlineOptions/errorCode`、`dependencies`、`io`、`capabilities.provides`（`src/core/plugin-sdk/types.ts:67-93`）。
- Online method contract 僅有 `"local" | "remote"`，且 online options 的 `method` 必須在 manifest runtime method 內（`src/core/plugin-sdk/types.ts:2-3`, `src/core/plugin-sdk/manifest.ts:311-321`）。
- Public PluginsManager API 與回傳型別集中在 `types.ts`：`ScanSummary`、`LifecycleActionResult`、`StartupReport`、`StateResult`、`RegistrySnapshotItem` 等（`src/core/pluginsManager/types.ts:78-161`）。
- Capability definition/schema contract 支援 JSON-schema-like type、properties、required、items、enum、additionalProperties，並可附 test cases（`src/core/plugin-sdk/types.ts:9-45`）。
- Capability provider registry 的 public surface 是 `register/resolve/tryResolve/has/list`；清理 API 標記 internal，應由 PluginsManager 管理 provider lifecycle（`src/core/registry/manager.ts:38-85`, `src/core/registry/manager.ts:87-103`）。

#### 架構觀察

- core 目前採「宣告與 runtime provider 分離」：manifest/capabilities manager 記錄 capability definition，plugin online 後才由 `getCapabilityBindings()` 建立 provider 並放入 runtime registry。
- `validateDependencies()` 是顯式 API，但 `onlineMany()` 自身也會在啟動 wave 中動態評估 dependency status；外層若忘記先呼叫 `validateDependencies()`，啟動仍會阻擋缺依賴/版本錯誤，只是錯誤呈現在 startup report。
- Diagnostics 設計同時保留 summarized log 與 raw log：一般 metadata 用 preview，raw event 另帶完整 payload/value/options；這對 Discord payload 或 plugin IO 很重要，但也代表 logger runtime 的 redaction 設定是安全邊界。
- 本次未檢視 `src/index.ts`、`tools/logger`、`src/systemPlugins`、`src/skillPlugins`、tests 或 docs；上述推論限於 core 原始碼與 root metadata。


### Archived Report: plugins-report.md

### Plugins 結構與慣例報告

#### 範圍與依據

本報告只根據實際插件目錄與必要的 plugin SDK/manifest 契約整理：

- `src/systemPlugins/`
- `src/skillPlugins/`
- `src/core/plugin-sdk/types.ts`
- `src/core/plugin-sdk/manifest.ts`

未讀取或修改 `src` 內非必要 production 程式碼以外的文件；本次唯一產出檔案為 `.agent/reports/plugins-report.md`。

#### 插件總覽

| 插件路徑 | 類型 | 版本 | method | startupWeight | capabilities | manifest 依賴 |
| --- | --- | --- | --- | ---: | --- | --- |
| `src/skillPlugins/example` | `skill` | `0.0.1` | `local`, `remote` | 0 | 無 | 無 |
| `src/systemPlugins/example` | `system` | `0.1.0` | `local`, `remote` | 0 | `system.echo.message` | 無 |
| `src/systemPlugins/llm-remote-gateway` | `system` | `1.3.1` | `remote` | 10 | `system.llm.remote.chat.stream`, `system.llm.remote.models.list`, `system.llm.remote.health.check` | 無 |
| `src/systemPlugins/conversation-history` | `system` | `1.1.1` | `local` | 25 | `system.conversation.history.append`, `system.conversation.history.recent`, `system.conversation.history.clear` | 無 |
| `src/systemPlugins/talk-engine` | `system` | `0.6.1` | `local` | 30 | `system.talk.engine.nostream`, `system.talk.engine.stream` | `llm-remote-gateway@1.3.1`, `discord@0.4.1`, `conversation-history@1.1.1` |
| `src/systemPlugins/discord` | `system` | `0.4.1` | `local` | 65 | `system.discord.conversation.stream`, `system.discord.message.send`, `system.discord.typing.start`, `system.discord.typing.stop` | 無 |

證據：

- `src/skillPlugins/example/plugin.manifest.json`
- `src/systemPlugins/example/plugin.manifest.json`
- `src/systemPlugins/llm-remote-gateway/plugin.manifest.json`
- `src/systemPlugins/conversation-history/plugin.manifest.json`
- `src/systemPlugins/talk-engine/plugin.manifest.json`
- `src/systemPlugins/discord/plugin.manifest.json`

#### 目錄結構模式

現有插件都採用「manifest + root entry + strategies」的基本形狀：

```text
plugin-name/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/index.ts 或 remote/index.ts
```

`example` 插件同時示範 `local` 與 `remote`：

- `src/skillPlugins/example/index.ts`
- `src/skillPlugins/example/strategies/index.ts`
- `src/skillPlugins/example/strategies/local/index.ts`
- `src/skillPlugins/example/strategies/remote/index.ts`
- `src/systemPlugins/example/index.ts`
- `src/systemPlugins/example/strategies/index.ts`
- `src/systemPlugins/example/strategies/local/index.ts`
- `src/systemPlugins/example/strategies/remote/index.ts`

實際 system plugin 則多半固定單一 strategy：

- `src/systemPlugins/llm-remote-gateway/strategies/index.ts` 只匯出 `remote`
- `src/systemPlugins/conversation-history/strategies/index.ts` 只匯出 `local`
- `src/systemPlugins/talk-engine/strategies/index.ts` 只匯出 `local`
- `src/systemPlugins/discord/strategies/index.ts` 只匯出 `local`

較複雜插件會在 strategy 底下拆出輔助模組：

- `src/systemPlugins/llm-remote-gateway/strategies/remote/constants.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/errors.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/messageValidator.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/payload.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/sse.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/types.ts`
- `src/systemPlugins/talk-engine/strategies/local/input.ts`
- `src/systemPlugins/talk-engine/strategies/local/promptComposer.ts`
- `src/systemPlugins/talk-engine/strategies/local/relayQueue.ts`
- `src/systemPlugins/talk-engine/strategies/local/streamCollector.ts`
- `src/systemPlugins/discord/strategies/local/typingSessionManager.ts`
- `src/systemPlugins/conversation-history/strategies/local/constants.ts`
- `src/systemPlugins/conversation-history/strategies/local/types.ts`

#### Manifest 慣例

`PluginManifest` 的欄位契約來自 `src/core/plugin-sdk/types.ts`，驗證邏輯來自 `src/core/plugin-sdk/manifest.ts`。

必要欄位：

- `meta.name`
- `meta.version`
- `meta.type`
- `meta.entry`
- `runtime.startupWeight`
- `runtime.method`

常見欄位：

- `meta.description`
- `runtime.onlineOptions.oneOf`
- `runtime.errorCode`
- `dependencies.system`
- `dependencies.skill`
- `io.input`
- `io.output`
- `io.examples`
- `capabilities.provides`

重要規則：

- `meta.type` 只接受 `skill` 或 `system`，證據：`src/core/plugin-sdk/types.ts`。
- `runtime.method` 只接受 `local` 或 `remote`，且必須是非空陣列，證據：`src/core/plugin-sdk/types.ts`、`src/core/plugin-sdk/manifest.ts`。
- `runtime.startupWeight` 是必要數字欄位，證據：`src/core/plugin-sdk/manifest.ts`。
- `runtime.priority` 已不支援；若出現會被 manifest validator 拒絕，證據：`src/core/plugin-sdk/manifest.ts` 與 `src/skillPlugins/example/README.md`。
- `runtime.onlineOptions.oneOf[].schema` 必須包含 `method` 欄位，而且 `when.method` 必須列在 `runtime.method` 裡，證據：`src/core/plugin-sdk/manifest.ts`。
- `dependencies.system` 與 `dependencies.skill` 的版本值必須是非空字串，證據：`src/core/plugin-sdk/manifest.ts`。
- `capabilities` 只允許 system plugin 使用；skill plugin manifest 不應宣告 `capabilities.provides`，證據：`src/core/plugin-sdk/manifest.ts`。

#### Lifecycle 與 root entry 模式

Plugin root entry 對外實作 `IPlugin`：

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<StateResult>`
- `send(options): Promise<unknown>`
- `getCapabilityBindings?(): CapabilityBinding[]`

證據：`src/core/plugin-sdk/types.ts`。

現有慣例是 root entry 只做三件事：

1. 驗證或選擇 method。
2. 把 lifecycle/send/provider 方法轉派到 strategy。
3. system plugin 如有 capability，透過 `getCapabilityBindings()` 將 capability id 綁到 provider 方法。

範例：

- `src/skillPlugins/example/index.ts` 使用 `mode: "local" | "remote"`，`online()` 和 `restart()` 依 `options.method` 切換 strategy，`offline()`、`state()`、`send()` 使用目前 mode。
- `src/systemPlugins/example/index.ts` 與 skill example 類似，但額外提供 `getCapabilityBindings()`，把 `system.echo.message` 綁到 `echoMessage()`。
- `src/systemPlugins/llm-remote-gateway/index.ts` 固定 `remote`，用 `assertRemoteMethod()` 防止錯誤 method。
- `src/systemPlugins/discord/index.ts`、`src/systemPlugins/talk-engine/index.ts`、`src/systemPlugins/conversation-history/index.ts` 固定 `local`，用 `assertLocalMethod()` 防止錯誤 method。

Strategy entry 對外實作 `IStrategy`：

- `method`
- `online()`
- `offline()`
- `restart()`
- `state()`
- `send()`

證據：`src/core/plugin-sdk/types.ts`。

現有 strategy 的 lifecycle 慣例：

- `online()` 初始化 runtime 狀態或設定。
- `offline()` 清理 runtime 狀態、cache、session 或設定。
- `restart()` 通常呼叫 `offline()` 再呼叫 `online(options)`。
- `state()` 回傳 `{ status: 1 }` 表示 online，`{ status: 0 }` 表示 offline；部分插件會做健康檢查，失敗時回傳 `{ status: -1 }`。
- lifecycle 採 throw-only；錯誤直接丟出，由上層 manager 統一處理。證據：`src/core/plugin-sdk/types.ts` 註解與 `src/skillPlugins/example/README.md`。

#### Capability 模式

Capability schema 型別與 provider binding 契約在 `src/core/plugin-sdk/types.ts`：

- `CapabilityDefinition` 包含 `id`、`displayName`、`description`、`version`、`input`、`output`、可選 `testCases`。
- `CapabilityProvideEntry` 可以是既有 capability id 字串，也可以是完整 capability definition 物件。
- `CapabilityBinding` 由 `capabilityId` 與 `createProvider(pluginInstance)` 組成。

現有 system plugin 的 capability 風格：

- `src/systemPlugins/example/plugin.manifest.json` 使用字串 `system.echo.message`，README 說明字串代表引用 core 預設能力表 ID。
- `src/systemPlugins/llm-remote-gateway/plugin.manifest.json` 內嵌三個完整 capability definition。
- `src/systemPlugins/conversation-history/plugin.manifest.json` 內嵌三個完整 capability definition。
- `src/systemPlugins/talk-engine/plugin.manifest.json` 內嵌兩個完整 capability definition。
- `src/systemPlugins/discord/plugin.manifest.json` 內嵌四個完整 capability definition。

Provider binding 對應：

- `src/systemPlugins/example/index.ts`: `system.echo.message` -> `echoMessage(input)`
- `src/systemPlugins/llm-remote-gateway/index.ts`: `system.llm.remote.chat.stream` -> `streamChat(input)`；`system.llm.remote.models.list` -> `listModels(input?)`；`system.llm.remote.health.check` -> `checkHealth(input?)`
- `src/systemPlugins/conversation-history/index.ts`: `system.conversation.history.append` -> `appendMessage(input)`；`system.conversation.history.recent` -> `getRecentMessages(scope, limit?)`；`system.conversation.history.clear` -> `clearConversation(scope)`
- `src/systemPlugins/talk-engine/index.ts`: `system.talk.engine.nostream` -> `generateReply(input)`；`system.talk.engine.stream` -> `streamReply(input)`
- `src/systemPlugins/discord/index.ts`: `system.discord.conversation.stream` -> `openConversationStream()`；`system.discord.message.send` -> `sendMessage(input)`；`system.discord.typing.start` -> `startTyping(input)`；`system.discord.typing.stop` -> `stopTyping(input)`

`send()` 仍保留為 plugin-level 相容入口，但現有 README 明確把正式 capability 邊界放在 provider 方法上：

- `src/systemPlugins/llm-remote-gateway/README.md`
- `src/systemPlugins/conversation-history/README.md`
- `src/systemPlugins/talk-engine/README.md`
- `src/systemPlugins/discord/README.md`
- `src/systemPlugins/example/README.md`

#### 各插件職責與依賴

##### `src/skillPlugins/example`

用途是 skill plugin 模板。manifest 宣告：

- `meta.type = "skill"`
- `runtime.method = ["local", "remote"]`
- `runtime.startupWeight = 0`
- `dependencies.system = {}`
- `dependencies.skill = {}`

實作模式：

- `index.ts` 依 `options.method` 切換 `mode`。
- `strategies/local/index.ts` 與 `strategies/remote/index.ts` 都維護簡單 `online` boolean。
- strategy 使用 `@core/logger` 建立 logger。
- `send()` 目前僅記錄並回傳 `undefined`，適合作為骨架範例。

證據：

- `src/skillPlugins/example/plugin.manifest.json`
- `src/skillPlugins/example/index.ts`
- `src/skillPlugins/example/strategies/local/index.ts`
- `src/skillPlugins/example/strategies/remote/index.ts`
- `src/skillPlugins/example/README.md`

##### `src/systemPlugins/example`

用途是 system plugin 模板，也是 skill example 的 system 鏡像。manifest 宣告：

- `meta.type = "system"`
- `runtime.method = ["local", "remote"]`
- `capabilities.provides = ["system.echo.message"]`

實作模式：

- root entry 與 skill example 類似，依 `mode` 轉派 strategy。
- 額外實作 `echoMessage()`，並在 `getCapabilityBindings()` 中將 provider 綁到 capability。
- local/remote strategy 都驗證 `options.message` 必須是 string，回傳 `{ reply, method }`。

證據：

- `src/systemPlugins/example/plugin.manifest.json`
- `src/systemPlugins/example/index.ts`
- `src/systemPlugins/example/strategies/local/index.ts`
- `src/systemPlugins/example/strategies/remote/index.ts`
- `src/systemPlugins/example/README.md`

##### `src/systemPlugins/llm-remote-gateway`

用途是 remote-only 的 OpenAI 相容 LLM gateway。manifest 宣告：

- `meta.type = "system"`
- `runtime.method = ["remote"]`
- `runtime.startupWeight = 10`
- online options 包含 `baseUrl`、`model`、`timeoutMs`、`connectionTimeoutMs`、`maxRetries`、`retryDelayBaseMs`、`reqId`、`reqIdHeader`、`headers`
- capability schema version 為 `2.0.0`

實作與依賴：

- `index.ts` 固定 `remote`，並提供 `streamChat()`、`listModels()`、`checkHealth()` provider。
- `strategies/remote/index.ts` 使用 `axios`、`EventEmitter`、`node:stream`。
- `streamChat()` 呼叫 `/v1/chat/completions`，回傳支援 `data/end/error/abort` 與 `abort()` 的 EventEmitter。
- `listModels()` 與 `checkHealth()` 使用 `/v1/models`。
- strategy 有 request id、observability log、SSE parsing、retry、timeout、reasoning diagnostics 等細節。
- `state()` 不是只看 online boolean，而是呼叫 health check；成功回 `{ status: 1 }`，失敗回 `{ status: -1 }`。

證據：

- `src/systemPlugins/llm-remote-gateway/plugin.manifest.json`
- `src/systemPlugins/llm-remote-gateway/index.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/index.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/payload.ts`
- `src/systemPlugins/llm-remote-gateway/strategies/remote/sse.ts`
- `src/systemPlugins/llm-remote-gateway/README.md`

##### `src/systemPlugins/conversation-history`

用途是 transcript store，負責對話歷史 append/recent/clear。manifest 宣告：

- `meta.type = "system"`
- `runtime.method = ["local"]`
- `runtime.startupWeight = 25`
- online options 包含 `historyDir`、`maxMessages`、`expireDays`、`backupCount`、`maxFileSize`
- capability schema version 為 `1.0.0`

實作與依賴：

- `index.ts` 固定 `local`，提供 `appendMessage()`、`getRecentMessages()`、`clearConversation()` provider。
- `strategies/local/index.ts` 使用 `node:fs`、`node:fs/promises`、`node:path`。
- runtime 使用 JSON 檔案加記憶體 cache。
- scope 以 `conversationId` 優先，其次使用 `userId`。
- 每個 scope 有序列化 lock，避免同一對話併發寫入造成遺失。
- 支援過期裁剪、最大訊息數裁剪、檔案輪轉與清除備份。
- `send()` 支援 `history.append`、`history.recent`、`history.clear` 與 capability id alias。

證據：

- `src/systemPlugins/conversation-history/plugin.manifest.json`
- `src/systemPlugins/conversation-history/index.ts`
- `src/systemPlugins/conversation-history/strategies/local/index.ts`
- `src/systemPlugins/conversation-history/README.md`

##### `src/systemPlugins/talk-engine`

用途是對話編排核心。manifest 宣告：

- `meta.type = "system"`
- `runtime.method = ["local"]`
- `runtime.startupWeight = 30`
- system dependencies: `llm-remote-gateway@1.3.1`、`discord@0.4.1`、`conversation-history@1.1.1`
- capability schema version 為 `2.1.0`

實作與依賴：

- `index.ts` 固定 `local`，提供 `generateReply()` 與 `streamReply()` provider。
- `strategies/local/index.ts` 使用 `capabilityRegistry` 取得其他 system capability provider。
- `promptComposer.ts` 負責把近期 history 與當前 user message 組成 LLM messages。
- `relayQueue.ts` 負責 Discord relay FIFO。
- `streamCollector.ts` 負責聚合 LLM stream。
- README 描述 relay 流程：讀 Discord inbound stream、start typing、呼叫 `generateReply()`、send message、stop typing。
- 當輸入缺少 `conversationId` 與 `userId` 時，維持舊相容路徑，不套用 history。

證據：

- `src/systemPlugins/talk-engine/plugin.manifest.json`
- `src/systemPlugins/talk-engine/index.ts`
- `src/systemPlugins/talk-engine/strategies/local/index.ts`
- `src/systemPlugins/talk-engine/strategies/local/promptComposer.ts`
- `src/systemPlugins/talk-engine/strategies/local/relayQueue.ts`
- `src/systemPlugins/talk-engine/strategies/local/streamCollector.ts`
- `src/systemPlugins/talk-engine/README.md`

##### `src/systemPlugins/discord`

用途是 Discord I/O system plugin。manifest 宣告：

- `meta.type = "system"`
- `runtime.method = ["local"]`
- `runtime.startupWeight = 65`
- online options 包含 `channelId`、`ownerUserId`、`nonOwnerDmReply`、`typingIntervalMs`
- capability schema version 為 `2.0.0`

實作與依賴：

- `index.ts` 固定 `local`，提供 conversation stream、message send、typing start/stop provider。
- `strategies/local/index.ts` 使用 `EventEmitter`、`@core/secrets`、`TypingSessionManager`。
- README 記載密鑰來源為 `DISCORD_TOKEN`、`DISCORD_USER_ID`、`DISCORD_CHANNEL_ID`。
- 群組只處理 mention bot 或 reply bot；DM 只接受 owner；typing session 以 `channelId` reference count，`offline()` 清理全部 session。
- `send()` 保留相容入口，但 capability registry 正式契約是 provider 方法。

證據：

- `src/systemPlugins/discord/plugin.manifest.json`
- `src/systemPlugins/discord/index.ts`
- `src/systemPlugins/discord/strategies/local/index.ts`
- `src/systemPlugins/discord/strategies/local/types.ts`
- `src/systemPlugins/discord/strategies/local/typingSessionManager.ts`
- `src/systemPlugins/discord/README.md`

#### README 模式

現有 README 大致分成兩種：

1. 模板型 README：`src/skillPlugins/example/README.md`
   - 基本資訊
   - 目錄
   - Manifest 規格
   - Lifecycle 契約
   - Strategy 分層
   - 新增 method 流程
   - 驗收清單

2. 實作型 README：system plugins
   - 插件定位
   - 版本與 capability 契約
   - Online Options 表格
   - Capability Provider Contract
   - `send()` 相容入口
   - 插件特有行為，例如 Discord typing、LLM SSE/retry、history scope/rotation、talk relay

README 慣例：

- 明確列出 plugin version。
- 明確列出 capability schema version。
- Online Options 使用欄位表格。
- Provider contract 使用 capability id 對應方法名稱。
- 說明 `send()` 是相容入口，而不是 provider-first 的主要邊界。
- 如果 manifest 新增或修改 capability，README 必須同步更新；`src/systemPlugins/example/README.md` 有明確提醒。

#### 新增插件建議流程

新增 skill plugin：

1. 在 `src/skillPlugins/{plugin-name}` 建立 `README.md`、`plugin.manifest.json`、`index.ts`、`strategies/index.ts`。
2. 若支援 local，建立 `strategies/local/index.ts`；若支援 remote，建立 `strategies/remote/index.ts`。
3. manifest 設定 `meta.type = "skill"`。
4. manifest 設定 `runtime.startupWeight` 與 `runtime.method`。
5. `runtime.onlineOptions.oneOf` 為每個 method 提供 schema，且 schema 必須包含 `method`。
6. root `index.ts` 實作 lifecycle 與 `send()`，依 method 轉派 strategy。
7. 不要在 skill plugin manifest 宣告 `capabilities.provides`，因 validator 只允許 system plugin 使用 capabilities。

新增 system plugin：

1. 在 `src/systemPlugins/{plugin-name}` 建立同樣的基本結構。
2. manifest 設定 `meta.type = "system"`。
3. 如果提供能力，在 `capabilities.provides` 宣告 capability id 或完整 definition。
4. 在 root `index.ts` 實作 provider 方法。
5. 實作 `getCapabilityBindings()`，把每個 `capabilityId` 綁到 provider 方法。
6. `send()` 可保留相容 action route，但 README 應把正式契約寫成 provider method。
7. 若依賴其他插件，在 manifest `dependencies.system` 或 `dependencies.skill` 寫入精確版本字串。

新增 method：

1. 新增 `strategies/{method}/index.ts`。
2. 更新 `strategies/index.ts` 匯出。
3. 更新 manifest `runtime.method`。
4. 更新 manifest `runtime.onlineOptions.oneOf`。
5. 更新 root entry 的 method 型別、assert 或 route 邏輯。
6. 更新 README 的 Online Options 與 lifecycle/strategy 說明。

新增 capability：

1. 只在 system plugin 上新增。
2. 在 manifest `capabilities.provides` 加入非空字串或完整 `CapabilityDefinition`。
3. 若是完整 definition，提供 `id`、`displayName`、`description`、`version`、`input`、`output`。
4. 在 root entry 新增 provider host type 與 provider method。
5. 在 `getCapabilityBindings()` 新增 `capabilityId` 對應。
6. 在 README 同步新增 provider contract。

#### 命名與實作慣例

- 插件目錄採 kebab-case，例如 `llm-remote-gateway`、`conversation-history`、`talk-engine`。
- capability id 採 dot namespace，例如 `system.llm.remote.chat.stream`。
- root entry 常命名 provider 方法為清楚的動詞片語，例如 `streamChat`、`listModels`、`checkHealth`、`appendMessage`、`generateReply`。
- strategy module 內部若複雜，使用 `constants.ts`、`types.ts`、`errors.ts`、`input.ts`、`payload.ts` 等小檔拆分。
- logger 命名包含 plugin、type、strategy，例如 example strategy 使用 `plugin-example-skill-local`。
- method 固定單一值的插件會定義 `METHOD_LOCAL` 或 `METHOD_REMOTE`，並用 assert function 防止錯誤 method。
- 複雜 I/O 使用 `EventEmitter` 表示 stream 類 output，README 與 manifest output 都會明確標示事件語義。

#### 驗收清單

新增或修改插件時，至少檢查：

- manifest 必填欄位完整。
- `runtime.method` 與 `onlineOptions.oneOf[].when.method` 一致。
- `onlineOptions.oneOf[].schema.method` 存在。
- 未使用已淘汰的 `runtime.priority`。
- dependencies 版本是非空字串。
- skill plugin 未宣告 capabilities。
- system plugin 的 `capabilities.provides` 與 `getCapabilityBindings()` 一致。
- root lifecycle 都有轉派到 strategy。
- strategy lifecycle 採 throw-only。
- `state()` 回傳 `StateResult`。
- `send()` 相容路由與 README 說明一致。
- README 同步更新 Online Options、capability provider contract、依賴與特有行為。


### Archived Report: tooling-readmes-report.md

### 工具與插件 README 盤點報告

#### 範圍與證據來源

本報告僅依指定範圍閱讀：

- `tools/`：`tools/updatelog/**`、`tools/logger/**`
- 插件 README：`src/systemPlugins/**/README.md`、`src/skillPlugins/**/README.md`
- 最小必要的 package scripts：`package.json`

未修改 `src/`、`tests/`、`docs/`、`Updates/`、package 檔案或 `AGENTS.md`。本次唯一產出檔案為 `.agent/reports/tooling-readmes-report.md`。

#### package scripts 中的工具入口

證據：`package.json`

| script | 執行方式 | 用途 |
| --- | --- | --- |
| `yarn updatelog:new` | `node tools/updatelog/cli.js new` | 互動或參數式建立 UpdateLog 檔案。 |
| `yarn updatelog:ensure` | `node tools/updatelog/cli.js ensure --staged` | pre-commit 類型檢查：staged 有非 Updates 變更時，確保已有合規 UpdateLog；互動模式可建立並 stage 新檔。 |
| `yarn updatelog:validate:staged` | `node tools/updatelog/cli.js validate --staged` | 驗證 staged 變更是否包含必要 UpdateLog，並驗證 UpdateLog 內容格式。 |
| `yarn updatelog:validate:push` | `node tools/updatelog/cli.js validate --push` | 以 upstream range 或 HEAD fallback 驗證 push 範圍內的 UpdateLog 規範。 |
| `yarn build` | `tsc`、`tsc-alias`、`yarn copy:assets` | 編譯與複製插件 manifest/assets，不屬本報告主要工具，但與插件交付有關。 |
| `yarn test` | `vitest --globals` | 執行測試。 |
| `yarn lint` | `eslint .` | 執行 lint。 |

#### tools/updatelog

證據：

- `tools/updatelog/cli.js`
- `tools/updatelog/lib/git.js`
- `tools/updatelog/lib/markdown.js`
- `tools/updatelog/lib/path.js`
- `tools/updatelog/lib/prompt.js`
- `tools/updatelog/lib/validate.js`
- `tools/updatelog/lib/version.js`
- `tools/updatelog/templates/main.json`
- `tools/updatelog/templates/plugin.json`
- `tools/updatelog/templates/registry.json`

##### 目的

`tools/updatelog` 是版本更新紀錄工具，用來建立與驗證 `Updates/` 底下的 Markdown 更新紀錄。CLI 文字與錯誤訊息多為繁體中文，支援主程式更新與插件更新兩類。

`tools/updatelog/templates/registry.json` 定義兩種 category：

- `main`：Main 主版本更新，模板為 `main.json`
- `plugin`：Plugin 插件更新，模板為 `plugin.json`

##### 執行方法

直接執行方式：

```bash
node tools/updatelog/cli.js new [--category main|plugin] [--plugin-type skill|system] [--plugin-name <name>] [--version x.y.z] [--force]
node tools/updatelog/cli.js ensure --staged
node tools/updatelog/cli.js validate --staged|--push
```

package script 方式：

```bash
yarn updatelog:new
yarn updatelog:ensure
yarn updatelog:validate:staged
yarn updatelog:validate:push
```

`new` 可透過 flags 非互動建立；若缺必要參數且終端可互動，會用 `tools/updatelog/lib/prompt.js` 問答收集資料。list 類欄位使用分號 `;` 分隔多筆。

常用參數包含：

- `--summary`
- `--added`
- `--changed`
- `--fixed`
- `--removed`
- `--impact`
- `--tests`
- `--risks`
- `--notes`

##### 會修改檔案的行為

`tools/updatelog/cli.js` 的 `createNewLog()` 會：

- 依 category 與 version 建立輸出路徑。
- 呼叫 `renderUpdateLog()` 產生 Markdown。
- 建立目錄。
- 寫入 Markdown 檔。

輸出位置由 `tools/updatelog/lib/path.js` 定義：

- main：`Updates/Main/v<major>/v<major>.<minor>/v<major>.<minor>.<patch>.md`
- plugin：`Updates/Plugins/<skill|system>/<plugin-slug>/v<major>/v<major>.<minor>/v<major>.<minor>.<patch>.md`

`ensure --staged` 在互動模式且缺 UpdateLog 時，會建立新 UpdateLog，並透過 `tools/updatelog/lib/git.js` 的 `stageFile()` 執行 `git add -- <file>` 將該 UpdateLog 加入 staged。

##### 驗證規則

`tools/updatelog/lib/validate.js` 會驗證：

- 路徑符合 `Updates/Main/...` 或 `Updates/Plugins/...` 規範。
- 必要段落存在：`Metadata`、`Summary`、`Changes`、`Impact`、`Tests`、`Risks & Rollback`、`Notes`。
- `Changes` 下必要子段落存在：`Added`、`Changed`、`Fixed`、`Removed`。
- 標題版本、Metadata Version、路徑版本一致。
- Metadata Category 與 Scope 與路徑一致。
- Commit 必須是 7 到 12 碼短 SHA 或 `unknown`。
- 各段落不可為空，且不可只使用 `待補`、`TBD`、`TODO` 等占位內容。

`tools/updatelog/lib/version.js` 要求嚴格 `x.y.z` 數字版本格式。

##### release / update-log 重點

此專案的 release/update-log 流程核心是 `tools/updatelog`：

- 行為變更前後應用 `yarn updatelog:new` 建立對應紀錄。
- pre-commit 類流程可透過 `yarn updatelog:ensure` 確保 staged 的非 `Updates/` 變更搭配 UpdateLog。
- push 前可用 `yarn updatelog:validate:push` 檢查 upstream range 內的變更。
- staged 檢查可用 `yarn updatelog:validate:staged`。

#### tools/logger

證據：

- `tools/logger/index.js`
- `tools/logger/lib/compress.js`
- `tools/logger/lib/levels.js`
- `tools/logger/lib/redaction.js`
- `tools/logger/lib/serializer.js`
- `tools/logger/lib/session.js`
- `tools/logger/lib/transports.js`

##### 目的

`tools/logger` 是 Node logger 工具模組，提供：

- `configureLogger(options)`
- `getLogger(name, bindings?)`
- `flushLogs()`
- `shutdownLogger()`
- `getCurrentLogSessionPath()`

它支援分級記錄、文字與 JSON 雙輸出、敏感資訊遮蔽、Error 序列化、console 層級控制、觀測診斷 ring buffer，以及舊 session 壓縮。

##### 執行方法

此工具不是 package script CLI。使用方式是由程式碼 `require`/匯入 `tools/logger/index.js`，再呼叫 `getLogger()` 取得 logger instance。

預設設定來自 `tools/logger/index.js`：

- rootDir：`logs`
- level：`info`
- console 預設只輸出 `warn`、`error`、`fatal`
- redaction 預設啟用
- observability diagnostic ring size 預設 `50`

可用環境變數：

- `LOG_STREAM_RAW=1|true|yes|on` 可啟用 raw direct export 行為。

##### 會修改檔案的行為

`tools/logger` 會修改檔案系統：

- `tools/logger/lib/session.js` 會建立 log root 與 session 目錄。
- `tools/logger/lib/transports.js` 會在 session 內建立：
  - `log/<logger>.log`
  - `json/<logger>.json`
- `tools/logger/lib/compress.js` 會壓縮舊 session 為 `.tar.gz`，並刪除已壓縮的舊 session 目錄。

預設位置為專案根目錄下的 `logs/`。

##### 安全與遮蔽

`tools/logger/lib/redaction.js` 內建遮蔽規則，涵蓋 token、API key、password、secret、Authorization/Bearer、email、信用卡樣式數字、x-api-key、client secret、refresh token 等。`tools/logger/lib/serializer.js` 也會處理 `Error`、`BigInt`、循環參照與 meta/bindings 遮蔽。

#### 插件本地 README 文件

##### `src/systemPlugins/example/README.md`

此 README 說明 system 版 example plugin 是 `src/skillPlugins/example` 的 system 鏡像，用於示範：

- `meta.type = "system"`
- `runtime.startupWeight`
- throw-only lifecycle
- `capabilities.provides`
- `getCapabilityBindings()` provider 綁定

文件列出 capability：

- `system.echo.message` -> `echoMessage(input)`

並說明 `send()` 僅作為 plugin-level 相容入口，不是 capability 邊界主契約。

##### `src/skillPlugins/example/README.md`

此 README 是 Skill/System 通用插件 README 模板，也描述 `src/skillPlugins/example`。內容包含：

- 基本資訊：plugin name、type、version、entry。
- 建議目錄結構。
- manifest 規格。
- `runtime.priority` 已淘汰，不可再使用。
- lifecycle 契約：`online`、`offline`、`restart`、`state`、`send`，失敗時直接 throw。
- strategy 分層：root plugin 負責 method 路由，strategy 負責 local/remote 實作。
- 新增 method 流程。
- 驗收清單：`yarn build`、`online -> state -> send -> offline`、依賴與版本、README 與 manifest 同步。

##### `src/systemPlugins/llm-remote-gateway/README.md`

此 README 說明 `llm-remote-gateway` 是 remote-only system plugin，提供 OpenAI 相容 API 能力。

能力：

- `system.llm.remote.chat.stream` -> `streamChat(input)`
- `system.llm.remote.models.list` -> `listModels(input?)`
- `system.llm.remote.health.check` -> `checkHealth(input?)`

版本與契約：

- plugin version：`1.3.1`
- capability schema version：`2.0.0`

Online options 指定 `method = "remote"`，需要 `baseUrl`，可設定 `model`、timeout、retry、request id header 與 headers。

`streamChat()` 使用 `/v1/chat/completions`，回傳 EventEmitter，支援 `data`、`end`、`error`、`abort` 與 `emitter.abort()`。`listModels()` 與 `checkHealth()` 使用 `/v1/models`。

##### `src/systemPlugins/discord/README.md`

此 README 說明 `discord` 是 Discord I/O system plugin。

能力：

- `system.discord.conversation.stream` -> `openConversationStream()`
- `system.discord.message.send` -> `sendMessage(input)`
- `system.discord.typing.start` -> `startTyping(input)`
- `system.discord.typing.stop` -> `stopTyping(input)`

版本與契約：

- plugin version：`0.4.1`
- capability schema version：`2.0.0`

Online options 指定 `method = "local"`，可設定 `channelId`、`ownerUserId`、`nonOwnerDmReply`、`typingIntervalMs`。

密鑰來源統一走 `@core/secrets`：

- `DISCORD_TOKEN`
- `DISCORD_USER_ID`
- `DISCORD_CHANNEL_ID`

文件也定義群組只處理 mention/reply bot、DM 只接受 owner、typing session 用 `channelId` 做 reference count。

##### `src/systemPlugins/talk-engine/README.md`

此 README 說明 `talk-engine` 是對話編排核心 plugin，依賴 LLM、Discord 與 conversation-history providers，並內建 local Prompt Composer。

能力：

- `system.talk.engine.nostream` -> `generateReply(input)`
- `system.talk.engine.stream` -> `streamReply(input)`

版本與依賴：

- plugin version：`0.6.1`
- capability schema version：`2.1.0`
- 依賴：
  - `system:llm-remote-gateway@1.3.1`
  - `system:discord@0.4.1`
  - `system:conversation-history@1.1.1`

文件描述 Prompt Composer 邊界：把 recent history 與當前 user message 組成 LLM messages；`talk-engine` 只消費 history provider，不直接管理儲存檔案。

Relay 流程在 `relayEnabled=true` 時會：

1. 透過 Discord `openConversationStream()` 訂閱 inbound。
2. 事件進 FIFO queue。
3. 呼叫 `startTyping()`。
4. 用 `generateReply()` 產生回覆。
5. 呼叫 `sendMessage()`。
6. 最後呼叫 `stopTyping()`。

##### `src/systemPlugins/conversation-history/README.md`

此 README 說明 `conversation-history` 是 v1 純上下文 transcript store plugin，負責保存、讀取與清除對話歷史，不負責 rolling summary、facts extraction、episodic memory、vector retrieval 等記憶強化能力。

版本與定位：

- plugin version：`1.1.1`
- capability schema version：`1.0.0`
- runtime method：`local`
- 儲存方式：JSON 檔案 + 記憶體 cache

能力：

- `system.conversation.history.append` -> `appendMessage(input): Promise<void>`
- `system.conversation.history.recent` -> `getRecentMessages(scope, limit?): Promise<HistoryMessage[]>`
- `system.conversation.history.clear` -> `clearConversation(scope): Promise<void>`

Online options 可設定：

- `historyDir`，預設 `./history`
- `maxMessages`，預設 `100`
- `expireDays`，預設 `7`
- `backupCount`，預設 `3`
- `maxFileSize`，預設 `1048576`

此插件會修改檔案：保存 JSON 歷史檔、清除 scope 對應 JSON 主檔與 `.json.N` 輪轉備份檔；預設目錄為專案根目錄的 `history/`。

#### 會修改檔案或狀態的工具總表

| 工具/插件 | 會修改的內容 | 證據路徑 |
| --- | --- | --- |
| `tools/updatelog` | 建立或覆寫 `Updates/.../*.md`，`ensure --staged` 可執行 `git add` stage 新 UpdateLog。 | `tools/updatelog/cli.js`、`tools/updatelog/lib/git.js`、`tools/updatelog/lib/path.js` |
| `tools/logger` | 建立 `logs/<session>/log/*.log` 與 `logs/<session>/json/*.json`；壓縮舊 session 為 `.tar.gz` 並刪除舊目錄。 | `tools/logger/lib/session.js`、`tools/logger/lib/transports.js`、`tools/logger/lib/compress.js` |
| `conversation-history` plugin | 寫入、裁剪、清除 `history/` JSON 歷史檔與輪轉備份。 | `src/systemPlugins/conversation-history/README.md` |
| `discord` plugin | 透過 Discord API 傳送訊息與 typing 狀態；本地檔案修改未在 README 中描述。 | `src/systemPlugins/discord/README.md` |
| `talk-engine` plugin | 透過 history provider 寫入 user/assistant history，並可透過 Discord provider relay 回覆。 | `src/systemPlugins/talk-engine/README.md` |

#### 文件同步觀察

- 插件 README 已明確標示 capability provider contract，尤其 `llm-remote-gateway`、`discord`、`talk-engine`、`conversation-history`。
- example skill README 是新插件文件模板，要求 README 與 manifest 同步。
- example system README 也明確要求新增或修改插件自帶能力表時，同步更新 README。
- release/update-log 相關工具已提供產生、ensure、staged 驗證與 push 驗證四種入口，且模板要求 Summary、Changes、Impact、Tests、Risks & Rollback、Notes 都有非占位內容。


### Archived Report: repository-architecture-report.md

### Repository Architecture 綜合報告

#### 範圍與證據邊界

本報告依任務限制，只直接讀取下列檔案：

- `.agent/reports/core-report.md`
- `.agent/reports/docs-report.md`
- `.agent/reports/plugins-report.md`
- `.agent/reports/tests-report.md`
- `.agent/reports/tooling-readmes-report.md`
- `.agent/reports/updates-report.md`
- `AGENTS.md`
- `package.json`
- `tsconfig.json`
- `tsconfig.test.json`
- `.editorconfig`
- `.gitignore`
- `README.md`
- `eslint.config.js`

本報告未直接讀取或修改 `src/`、`tests/`、`docs/`、`Updates/`、`tools/`。凡引用這些路徑，都是根據六份既有 agent 報告整理而來；根目錄設定與指令則由本次直接讀取確認。唯一寫入檔案為 `.agent/reports/repository-architecture-report.md`。

#### 整體架構摘要

Demonkernel 是 TypeScript Node 專案，核心定位是「插件導向 runtime」。直接證據：`package.json` 顯示套件名 `demonkernel`、版本 `0.15.2`、MIT 授權，並以 Yarn scripts 管理開發、建置、測試、updatelog 流程。`tsconfig.json` 顯示編譯目標為 `ES2022`、模組系統為 `NodeNext`、`rootDir` 是 `src`、輸出至 `dist`，並提供 `@core/* -> ./src/core/*` path alias。

架構分層可供 `AGENTS.md` 摘要如下：

- Runtime code 位於 `src/`；核心框架在 `src/core`，skill plugins 在 `src/skillPlugins`，system plugins 在 `src/systemPlugins`。證據：`AGENTS.md`；同樣分類也出現在 `.agent/reports/core-report.md`、`.agent/reports/plugins-report.md`。
- 核心框架分成 PluginsManager、Plugin SDK、CapabilitiesManager、CapabilityRegistry、SecretsManager、Logger façade 等模組。證據：`.agent/reports/core-report.md`。
- 插件生命週期由 PluginsManager 掃描、驗證、依賴排序、上線、離線、重啟與狀態查詢。重要契約包含 `runtime.startupWeight`、精確版本依賴、throw-only lifecycle、`type:name` registry key。證據：`.agent/reports/core-report.md`、`.agent/reports/docs-report.md`、`.agent/reports/updates-report.md`。
- Capability 架構採「描述與執行分離」：manifest/capabilities manager 記錄 capability definitions，plugin online 後才由 `getCapabilityBindings()` 建立 provider 並註冊到 runtime registry。證據：`.agent/reports/core-report.md`、`.agent/reports/docs-report.md`、`.agent/reports/plugins-report.md`。
- 目前 capability 呼叫模式已從舊式 `send(action)` multiplex 轉成 provider-first methods；`send()` 只應視為 plugin-level 相容入口。證據：`.agent/reports/plugins-report.md`、`.agent/reports/updates-report.md`。
- SecretsManager 是插件讀取密鑰的唯一邊界；插件不應直接讀 `process.env`。證據：`.agent/reports/docs-report.md`、`.agent/reports/tests-report.md`、`.agent/reports/updates-report.md`。
- Logger/observability 使用結構化 log、redaction、request-scoped raw diagnostic ring buffer；高頻或敏感 payload 不應常態完整落盤。證據：`.agent/reports/core-report.md`、`.agent/reports/tooling-readmes-report.md`、`.agent/reports/updates-report.md`。

#### Build、Test 與維護流程

直接確認的 project scripts：

- `yarn dev`：以 `ts-node src/index.ts` 執行開發入口。證據：`package.json`。
- `yarn build`：執行 `tsc -p tsconfig.json`、`tsc-alias -p tsconfig.json`，再用 `yarn copy:assets` 複製 `src/**/plugin.manifest.json` 與 `src/**/assets/**` 到 `dist`。證據：`package.json`。
- `yarn start`：先 build，再執行 `node dist/index.js`。證據：`package.json`。
- `yarn test`：執行 `vitest --globals`。證據：`package.json`。
- `yarn lint`：執行 `eslint .`。證據：`package.json`。
- `yarn updatelog:new`、`yarn updatelog:ensure`、`yarn updatelog:validate:staged`、`yarn updatelog:validate:push`：包裝 `tools/updatelog/cli.js`。證據：`package.json`；工具細節來自 `.agent/reports/tooling-readmes-report.md`。

直接確認的編譯與測試設定：

- 主 tsconfig 使用 strict TypeScript、`NodeNext`、`ES2022`、`sourceMap: true`、`include: ["src"]`、排除 `node_modules` 與 `dist`。證據：`tsconfig.json`。
- 測試 tsconfig 繼承主設定，`rootDir: "."`、`noEmit: true`、載入 `node` 與 `vitest/globals` types，包含 `src` 與 `tests`。證據：`tsconfig.test.json`。
- ESLint 套用於 `**/*.ts`，使用 `@typescript-eslint/parser`，禁止 `var`，關閉 base `no-unused-vars`，改由 `@typescript-eslint/no-unused-vars` 警告。證據：`eslint.config.js`。
- `.editorconfig` 規定兩空格縮排、LF、UTF-8、trim trailing whitespace、final newline。證據：`.editorconfig`。
- `.gitignore` 排除 `node_modules/`、`dist/`、`coverage/`、`.env`、`.DS_Store`、`*.log`、`logs/`、`history/`。證據：`.gitignore`。

維護慣例：

- 行為變更應搭配 UpdateLog；現有 AGENTS 已提到 `yarn updatelog:new` 與 `yarn updatelog:ensure`。證據：`AGENTS.md`、`package.json`、`.agent/reports/tooling-readmes-report.md`、`.agent/reports/updates-report.md`。
- 測試架構重點覆蓋 core orchestration、capability contract、system plugin behavior、secrets guard；外部服務多以 mock 或 fixture 模擬，未保證真實 Discord/LLM 端到端。證據：`.agent/reports/tests-report.md`。
- README 根檔目前為空檔，不能當作架構來源。證據：`README.md` 長度為 0，讀取內容為空。

#### 主要子系統與穩定契約

##### PluginsManager / Plugin SDK

AGENTS 應明確提醒：

- manifest 必填 `meta.name/version/type/entry`、`runtime.startupWeight`、`runtime.method`。證據：`.agent/reports/plugins-report.md`。
- 不要使用已淘汰的 `runtime.priority`。證據：`.agent/reports/plugins-report.md`、`.agent/reports/updates-report.md`。
- lifecycle failure model 是 throw-only，由 manager 捕捉並轉成狀態與結果。證據：`.agent/reports/core-report.md`、`.agent/reports/docs-report.md`。
- dependencies 使用精確版本字串；system/skill dependency 都會影響啟動排序與 blocked/error 狀態。證據：`.agent/reports/core-report.md`、`.agent/reports/plugins-report.md`。
- cycle 不是一律錯誤，但需要用 `startupWeight`、延遲初始化或 provider resolve 時機避免競態。證據：`.agent/reports/updates-report.md`。

##### Capabilities / Registry

AGENTS 應包含：

- 只有 system plugin 可宣告 `capabilities.provides`。證據：`.agent/reports/docs-report.md`、`.agent/reports/plugins-report.md`。
- `capabilities.provides` 可以引用預設 capability id，或內嵌完整 definition。證據：`.agent/reports/docs-report.md`、`.agent/reports/plugins-report.md`。
- system plugin 宣告 capability 後，root entry 必須提供一致的 `getCapabilityBindings()`。證據：`.agent/reports/core-report.md`、`.agent/reports/plugins-report.md`。
- 新增 capability 時，manifest、provider method、binding、README 與測試都要同步。證據：`.agent/reports/plugins-report.md`、`.agent/reports/tests-report.md`。

##### System Plugins

根據 `.agent/reports/plugins-report.md`，現有 system plugins 包含：

- `src/systemPlugins/llm-remote-gateway`：remote-only OpenAI-compatible gateway，能力包含 chat stream、models list、health check。
- `src/systemPlugins/discord`：Discord I/O plugin，能力包含 conversation stream、message send、typing start/stop。
- `src/systemPlugins/conversation-history`：純 transcript store，能力包含 append/recent/clear；預設寫入 `history/`。
- `src/systemPlugins/talk-engine`：對話編排核心，依賴 LLM、Discord、conversation-history providers，提供 no-stream/stream reply。
- `src/systemPlugins/example`：system plugin template，示範 capability binding。

AGENTS 不需要列出每個 capability schema 的完整欄位，但應寫出這些 plugin 的角色與常見依賴方向，避免 main agent 把 I/O、LLM、history、orchestration 職責混在同一層。

##### Secrets

AGENTS 應保留安全規則：

- 真實 secret 放 `.env`，不可 commit；`.gitignore` 已忽略 `.env`。證據：`AGENTS.md`、`.gitignore`。
- 插件密鑰存取走 `@core/secrets`，不要直接讀 `process.env`。證據：`.agent/reports/docs-report.md`、`.agent/reports/tests-report.md`。
- 變更 secret handling 時補 `tests/secrets`。證據：`AGENTS.md`、`.agent/reports/tests-report.md`。

#### 文件可信度排序

以下排序是給 main agent 合成或更新 `AGENTS.md` 時判斷採信順序用。

1. 高可信：根目錄機器可執行設定
   - `package.json`、`tsconfig.json`、`tsconfig.test.json`、`.editorconfig`、`.gitignore`、`eslint.config.js` 是本次直接讀取的現況證據。
   - 用途：命令、編譯模式、lint/style、忽略檔案、版本號應以這些為準。

2. 高可信：現有 `AGENTS.md` 的通用貢獻規範
   - 內容與根目錄設定一致，包括 Yarn scripts、專案結構、style、test、commit、secrets。
   - 風險：目前偏一般性，缺少更細的插件/capability/observability 契約。

3. 中高可信：`.agent/reports/core-report.md`、`.agent/reports/plugins-report.md`、`.agent/reports/tests-report.md`
   - 這三份報告含大量實作與測試細節、檔案路徑、契約整理。
   - 風險：本次未直接複核 `src/` 或 `tests/`，因此若 main agent 要做精準程式修改，仍應再讀對應原始檔。

4. 中高可信：`.agent/reports/docs-report.md`、`.agent/reports/tooling-readmes-report.md`
   - 適合萃取文件地圖、README 慣例、updatelog/logger 工具行為。
   - 風險：README 與 docs 可能落後實作；其中 docs-report 已指出 capability test case 與 logger migration 文件可能有舊語意。

5. 中可信：`.agent/reports/updates-report.md`
   - 適合理解歷史決策、已棄用設計、版本脈絡。
   - 風險：更新紀錄是歷史事實來源，不一定代表目前程式碼仍完全一致；用來判斷「為什麼不該恢復舊設計」很有價值。

6. 低可信：根 `README.md`
   - 本次讀取為空檔，不應作為架構或使用說明來源。

#### 建議 AGENTS.md 應包含

建議 main agent 合成 `AGENTS.md` 時保留現有結構，並加入以下高價值規則：

- 專案定位：TypeScript Node、plugin-oriented runtime；`src/core` 是框架，`src/skillPlugins` 與 `src/systemPlugins` 是插件層。
- 建置命令：使用 Yarn；保留 `yarn dev`、`yarn build`、`yarn start`、`yarn test`、`yarn lint`、`yarn updatelog:*`。
- TypeScript 設定：strict、NodeNext、ES2022、`@core/*` alias；測試用 `tsconfig.test.json` 覆蓋 `src` 與 `tests`。
- 插件契約：manifest 使用 `runtime.startupWeight`，不得使用 `runtime.priority`；lifecycle throw-only；dependencies 精確版本；plugin folder 使用 kebab-case。
- Capability 契約：只有 system plugin 宣告 capabilities；capability provider-first；新增 capability 必須同步 manifest、binding、README、測試。
- Secrets 規則：插件透過 `@core/secrets`，不要直接讀 `process.env`；改動 secrets 時跑/補 `tests/secrets`。
- Logger/observability 規則：避免高頻路徑完整 raw payload 常態落盤；注意 redaction、requestId、outcome、raw diagnostic ring buffer。
- Testing 規則：一般變更至少跑相關 narrow tests；跨 core/plugin/capability contract 變更應跑 `yarn test`；外部服務行為多為 mock 覆蓋，真實端到端需另行標示。
- UpdateLog 規則：行為變更、新增 plugin/capability、診斷輸出或 Discord/LLM 行為變更應建立 UpdateLog；提交前可用 `yarn updatelog:ensure` 或 validate scripts。
- 產物與狀態目錄：不要提交 `dist/`、`logs/`、`history/`、`.env`；這些由 `.gitignore` 排除。

#### 建議 AGENTS.md 不應包含

- 不應把根 `README.md` 當作可靠入口，因目前是空檔。
- 不應列出過細、容易漂移的 capability JSON schema 全文；應指向 manifest/README/docs，或要求修改時讀原始檔。
- 不應鼓勵使用舊設計：`runtime.priority`、plugin-wide `send(action)` 作為 capability 主入口、直接 `process.env`、直接 `console.*` 作為 runtime 診斷、常態完整 raw stream/content 落盤。
- 不應承諾真實 Discord 或 LLM 端到端已由現有測試完整覆蓋；測試報告顯示多數外部服務測試使用 mock/fixture。
- 不應寫死每個 system plugin 的完整版本與 capability 清單，除非 AGENTS 維護者願意在每次 plugin release 同步更新；可只保留角色摘要與「修改時檢查 manifest/README/UpdateLog」。
- 不應要求所有小改都跑全量測試到阻塞開發；可要求依風險跑 narrow tests，但跨契約或 release 前跑 `yarn test`。
- 不應將 `.agent/reports/*` 當作最終真相；它們適合導覽，實作修改前仍需讀對應原始檔。

#### 給 main agent 的合成建議

現有 `AGENTS.md` 已經有良好的基本章節：Project Structure、Commands、Coding Style、Testing、Commit/PR、Security。建議不要重寫成長篇架構白皮書，而是在每節補入少量高信號規則：

- 在 Project Structure 補「core/plugin/capability/registry/secrets/logger」的角色一句話。
- 在 Commands 補 `updatelog:validate:staged` 與 `updatelog:validate:push`，並說明 `build` 會複製 plugin manifest/assets。
- 在 Coding Style 補 plugin/capability 命名慣例：plugin kebab-case、capability dot namespace、provider method 用動詞片語。
- 新增或擴充 Plugin Architecture 小節，寫清 startupWeight、throw-only、provider-first、system-only capabilities、exact dependency versions。
- 在 Testing 補 narrow test examples：`tests/secrets`、`tests/pluginsManager`、`tests/capabilities`、`tests/systemPlugins`，並提醒外部 integration 多為 mock。
- 在 Security 補 logger raw diagnostics 與 secret access 邊界。

以上內容可直接供主 agent 合成精簡但更準確的 `AGENTS.md`。


## Interfaces and Dependencies

本計畫沒有修改 runtime interfaces、package dependencies 或 TypeScript APIs。持久文件介面如下：

- `AGENTS.md`：本 repository 的 root agent operating guide。
- `.agent/PLANS.md`：繁體中文 ExecPlan 規則與骨架。
- `plans/active/repository-agent-environment.exec.md`：本 living plan。
- `Archived Reconnaissance Reports`：原 `.agent/reports/*.md` 的完整內嵌歸檔，用於說明 repository history、docs、tests、core architecture、plugin patterns、tooling 與整體 architecture；原 `.agent/reports` 暫存目錄已刪除。
