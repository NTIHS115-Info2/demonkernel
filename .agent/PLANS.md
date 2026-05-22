# Codex 執行計畫（ExecPlans）

本文件定義本專案的執行計畫（ExecPlan）規範。ExecPlan 是一份可執行的設計文件，讓 coding agent 或人類維護者可以依照它交付一個可運作、可驗證的功能或系統變更。請把讀者視為第一次接觸本 repository 的新手：他們只有目前工作樹與單一 ExecPlan 檔案，沒有先前對話記憶，也沒有外部脈絡。

本文件以 OpenAI Cookbook「Using PLANS.md for multi-hour problem solving」中的 Codex ExecPlan guide 為準，並以繁體中文改寫成適合本 repository 使用的規則。

## 如何使用 ExecPlans 與 PLANS.md

撰寫 ExecPlan 時，必須逐條遵守本 `.agent/PLANS.md`。如果本文件不在目前 context 中，先完整重新閱讀本文件，再開始撰寫或修改計畫。撰寫規格時，先從下方骨架開始，並在研究程式碼與文件的過程中逐步補齊。

每份新的、被接受的 ExecPlan 都必須在開始實作前綁定 `Target Version`。Target Version 必須寫在標題與 opening note 之後，格式如 `Target Version: v0.16.0`。新的 ExecPlan 使用目前最新 Minor 的下一個版本；同一份 ExecPlan 首次完整修改後的補充、修正、追加測試、文件補強或回歸修復，使用同一 Minor 下的下一個 Patch。

執行 ExecPlan 時，不要要求使用者提供「下一步」。直接依計畫推進到下一個里程碑。每次停下來前，都必須更新所有 living sections，尤其是 `Progress`，清楚寫出已完成事項與下一步。遇到合理歧義時，agent 應自主做出保守決策，並在 `Decision Log` 記錄原因。

討論或修訂 ExecPlan 時，必須把決策寫入計畫中的 `Decision Log`，讓後續讀者能理解規格為何改變。ExecPlan 是 living document；任何時候都應能只靠目前這份 ExecPlan 與 repository 工作樹重新開始。

當需求風險高、未知多、或設計有挑戰時，可使用 milestone 做 proof of concept 或小型原型，以驗證方案可行性。原型必須可執行、可觀察、可丟棄，並明確說明升級為正式實作或棄用的條件。

## 不可協商要求

每份 ExecPlan 都必須完全自足。自足代表它目前的內容包含新手完成工作所需的所有知識、假設、檔案路徑、命令、驗證方式與判斷標準。

每份 ExecPlan 都是 living document。工作推進、發現新事實、或設計決策成形時，貢獻者必須更新計畫；每次更新後，計畫仍必須維持自足。

每份 ExecPlan 都必須讓完全不熟悉本 repository 的讀者可以端到端完成該變更。不要假設讀者知道先前對話、舊 plan、或未寫在檔案裡的背景。

每份 ExecPlan 都必須導向可示範的有效行為，而不只是「有修改程式碼」。如果是內部變更，也要說明如何用測試、命令、日誌、或小型情境證明它有效。

每份 ExecPlan 都必須維護對應的 `Updates/Main` 更新紀錄。每次更新，不論是 Major、Minor 或 Patch，都必須反映在 `Updates/Main`。Agent 必須使用 `npm run updatelog:new`，或等價的 `node tools/updatelog/cli.js new`，產生或更新更新紀錄。

每份 ExecPlan 的最後一個實作動作必須是 README consistency check。這個動作必須確認 `README.md` 與 `README.zh-TW.md` 都已反映本次變更，兩份文件互相連結，章節順序一致，repository facts、command lists、release marker value 與維護規範等價，並執行 `yarn readme:check-version`。如果本次更新不需要變更 README，也必須在 `Artifacts and Notes` 與最終回報中寫明已檢查且不需更新。

每份 ExecPlan 都必須用白話定義所有專門術語。若一個詞不屬於一般語言，例如 daemon、middleware、registry、manifest、capability，第一次出現時必須說明它在本 repository 中對應到哪些檔案、模組或命令。

目的與意圖必須優先。開頭要用幾句話說明這項工作為何對使用者或維護者有價值：完成後能做什麼以前不能做的事，以及如何看到它正在運作。接著再引導讀者完成具體步驟，包括要改哪些檔案、執行哪些命令、應觀察到什麼。

不要把關鍵知識外包給外部文章或文件。如果工作需要某些知識，必須用自己的話嵌入 ExecPlan。若本 ExecPlan 建立在另一份已提交的 ExecPlan 之上，可以引用該 repository 相對路徑；若該檔案未提交，必須把相關脈絡完整納入目前計畫。

## 格式規則

在聊天或 issue 內貼出 ExecPlan 時，整份 ExecPlan 必須是一個單一的 `md` fenced code block，從三個反引號開始並以三個反引號結束。不得在其中巢狀使用其他三反引號 code fence；若需要展示命令、輸出、diff 或程式片段，使用縮排區塊。

當 ExecPlan 寫入 Markdown 檔案，且該檔案本身只包含這一份 ExecPlan 時，不要包外層三反引號。本 repository 的 `plans/active/*.exec.md` 檔案即採用這種形式。

標題後使用兩個換行。使用標準 Markdown 標題層級，例如 `#`、`##`、`###`。敘事段落以完整句子為主；除非清單能讓內容更清楚，否則避免過長條列、表格或 checklist。Checklist 僅在 `Progress` 中是必要格式。

ExecPlan 必須包含並維護以下 sections，名稱請照寫，方便 agent 與人類快速定位：

- `Purpose / Big Picture`
- `Progress`
- `Surprises & Discoveries`
- `Decision Log`
- `Outcomes & Retrospective`
- `Context and Orientation`
- `Plan of Work`
- `Concrete Steps`
- `Validation and Acceptance`
- `Idempotence and Recovery`
- `Artifacts and Notes`
- `Interfaces and Dependencies`

## 寫作準則

自足與白話最重要。引入任何非日常用語時，立即定義，並說明它在本 repository 中如何出現。不要寫「如前所述」或「依照架構文件」而不提供必要內容；即使重複，也要把完成工作所需資訊寫在本計畫中。

避免常見失敗模式。不要依賴未定義術語。不要把功能描述得過窄，導致實作雖然編譯通過卻沒有可觀察價值。不要把關鍵決策丟給讀者。存在歧義時，計畫應自行做出選擇並說明理由。

用可觀察結果錨定計畫。Acceptance 應描述人類可以驗證的行為，例如「在 repository root 執行 `yarn test tests/secrets`，應看到測試通過」，而不是只寫「新增某個 class」。若變更是內部行為，說明可透過哪個測試、CLI、日誌或情境證明影響。

明確寫出 repository 脈絡。使用 repository 相對路徑命名檔案，例如 `src/core/pluginsManager/index.ts`。命名函式、模組、型別與服務時要精確。若會觸及多個區域，先用一段 orientation 說明它們如何互相連動。

命令必須具體。寫出工作目錄與完整命令列。若命令輸出是驗證證據，放入簡短預期輸出或摘錄，讓新手知道成功與失敗長什麼樣子。

步驟要安全且可重複。若某步驟可以重跑，明確說明。若可能中途失敗，寫出如何重試或恢復。若需要 migration 或 destructive operation，必須提供備份、回復或安全替代方案。

驗證不可省略。計畫必須說明要跑哪些測試、如何啟動或操作系統、應觀察哪些輸出。對新功能或新能力，要包含足以證明行為的測試或端到端情境。若能證明「修改前失敗、修改後通過」，應清楚描述。

捕捉證據。當步驟產生命令輸出、短 diff 或日誌時，在 `Artifacts and Notes` 放入精簡且聚焦的摘錄。避免貼入巨大 blob；只保留足以證明成功或解釋決策的內容。

## Milestones

Milestone 是敘事，不是官僚流程。若工作被拆成里程碑，每個 milestone 都要用短段落說明範圍、完成後會多出什麼、要跑哪些命令、以及預期觀察到什麼。`Progress` 與 milestone 不同：milestone 說明故事與驗證方式，`Progress` 追蹤細部完成狀態。兩者都必須存在。

每個 milestone 必須可獨立驗證，並逐步推進整體目標。不要為了簡短而省略未來實作者可能需要的重要細節。

## Living Plans 與設計決策

ExecPlan 必須維護 `Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective`。這些 sections 不可省略，也不可只留空殼。

`Progress` 使用 checklist，並在每個項目前加入日期或時間戳。每次停下來前都要更新此 section；如果某工作只完成一半，要拆成已完成與剩餘部分。

`Surprises & Discoveries` 記錄實作期間發現的意外行為、bug、效能取捨、工具限制、或改變方案的重要洞察。每個 observation 應附簡短 evidence，例如命令輸出、檔案路徑、測試結果或錯誤訊息。

`Decision Log` 記錄所有會影響後續維護者的決策。格式如下：

- Decision: 寫下做了什麼選擇。
  Rationale: 說明為何做此選擇，以及拒絕了哪些合理替代方案。
  Date/Author: 日期與作者。

若中途改變方向，必須在 `Decision Log` 說明原因，並在 `Progress` 反映影響。ExecPlan 不只是目前 agent 的 checklist，也是下一位維護者的接手文件。

在完成重大 milestone 或整份計畫時，於 `Outcomes & Retrospective` 記錄結果、剩餘缺口與學到的事，並回頭對照原本目的。

## 版本與 UpdateLog 規則

Major (`*.0.0`) 只能由專案管理員指定與增加。Agent 不得自行提升 Major，也不得推測 Major 版本變更。

Minor (`0.*.0`) 跟隨 ExecPlan。一份新的、被接受的 ExecPlan 代表一個新的 Minor 版本。ExecPlan 在開始實作前必須綁定 Target Version，例如 `v0.16.0`。

Patch (`0.0.*`) 跟隨同一份 ExecPlan 的後續補充任務。當 ExecPlan 的首次完整修改已完成後，若又出現修正、補充、追加測試、文件補強或回歸修復，應增加 Patch，例如 `v0.16.1`。

多份 ExecPlan 同時存在時，新的 ExecPlan 使用當前最新 Minor 的下一個版本。舊 ExecPlan 若後續還有變動，不再取得新的 Minor，而是增加目前版本下的 Patch。`Updates/Main` 仍需依照實際更新時間記錄該次更新。

每次更新都必須建立或更新 UpdateLog。優先使用：

    npm run updatelog:new

若需要非互動或等價操作，可使用：

    node tools/updatelog/cli.js new

`Updates/Main` 是全域更新索引；每一次更新，不論 Major、Minor 或 Patch，都必須反映在 `Updates/Main`。若 plugin 自身也有行為或契約變更，另視情況新增或更新 `Updates/Plugins/{skill|system}/...`。

## README 雙語同步規則

根目錄入口文件包含英文版 `README.md` 與繁體中文版 `README.zh-TW.md`。兩份 README 必須維持雙向連結、相同章節順序、相同 repository facts、相同 command lists、相同 release marker value，以及等價的維護規範。它們是同一份入口內容的不同語言版本，不可把中文版當摘要，也不可只更新英文版。

撰寫或執行 ExecPlan 時，只要本次工作影響 project layout、architecture、plugins、commands、UpdateLog workflow、agent workflow、documentation trust order、testing guidance 或其他 README 會描述的內容，就必須把兩份 README 列入工作範圍。若判斷 README 不需改，仍要把檢查結果寫入 `Artifacts and Notes`。

每份 ExecPlan 的 `Concrete Steps` 最後一個步驟必須是 README consistency check。該步驟應明確要求：

    1. 檢查 `README.md` 與 `README.zh-TW.md` 互相連結。
    2. 檢查兩份 README 的章節順序、事實、命令清單、版本 marker 與維護規範等價。
    3. 執行 `yarn readme:check-version`。
    4. 將檢查結果記錄到 `Artifacts and Notes` 與最終回報。

## 原型與平行實作

當原型能降低大型變更風險時，鼓勵加入明確的 prototyping milestone。例如：先新增低階操作以驗證可行性，或平行探索兩種組合順序並測量差異。原型必須保持 additive、可測試、可回收，並清楚標示範圍。

在大型 migration 中，保留新舊路徑的平行實作是可接受的，只要它能降低風險並讓測試持續通過。計畫必須說明如何驗證兩條路徑，以及何時安全移除舊路徑。

當工作涉及多個新 library 或多個功能區域時，考慮建立彼此獨立的 spike，先證明外部 library 或子功能能獨立滿足需求，再整合到完整實作。

## 良好 ExecPlan 骨架

以下骨架可直接複製到 `plans/active/<name>.exec.md`，再依實際任務補齊。若該檔案只包含 ExecPlan，不要加外層三反引號。

    # <短而具行動性的描述>

    This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

    This ExecPlan is maintained according to `.agent/PLANS.md`.

    Target Version: v0.16.0

    ## Purpose / Big Picture

    用幾句話說明完成後使用者或維護者得到什麼，以及如何看到它運作。描述可觀察行為，而不只是內部修改。

    ## Progress

    使用 checklist 追蹤細部步驟。每個停止點都必須更新。

    - [x] (YYYY-MM-DD HH:MM TZ) 範例已完成項目。
    - [ ] 範例未完成項目。
    - [ ] 範例部分完成項目（已完成：X；剩餘：Y）。

    ## Surprises & Discoveries

    記錄意外發現、工具限制、bug、效能取捨或會影響方案的重要事實，並附 evidence。

    - Observation: ...
      Evidence: ...

    ## Decision Log

    記錄工作期間的所有重要決策。

    - Decision: ...
      Rationale: ...
      Date/Author: ...

    ## Outcomes & Retrospective

    在 milestone 或計畫完成時，摘要達成結果、剩餘缺口、驗證結果與學到的事，並對照原始目的。

    ## Context and Orientation

    把與任務相關的現況寫到新手也能理解。明確列出關鍵檔案、模組與術語定義。不要依賴先前對話。

    ## Plan of Work

    用 prose 描述編輯與新增順序。每個編輯要寫出檔案路徑、位置、要插入或修改的內容，以及原因。保持具體且最小化。

    ## Concrete Steps

    列出要在 repository root 或其他明確工作目錄執行的命令。若有重要輸出，放入精簡預期 transcript。

    最後一個實作步驟必須是 README consistency check：確認 `README.md` 與 `README.zh-TW.md` 都已更新或已判定不需更新，兩份文件互相連結，章節順序一致，事實、命令、版本 marker 與維護規範等價，並執行 `yarn readme:check-version`。

    ## Validation and Acceptance

    說明如何啟動、操作或測試系統，以及應觀察到什麼。Acceptance 必須是可由人類驗證的行為。

    Acceptance 必須包含 README consistency acceptance：`README.md` 與 `README.zh-TW.md` 的內容等價、互相連結、版本 marker 一致，且 `yarn readme:check-version` 通過或明確記錄不能執行的原因。

    ## Idempotence and Recovery

    說明哪些步驟可安全重跑。若步驟有風險，提供重試、恢復或回復方式。

    ## Artifacts and Notes

    放入最重要的命令輸出、短 diff、日誌或證據摘錄。保持精簡，聚焦在證明成功或解釋決策。

    ## Interfaces and Dependencies

    具體說明要使用的 library、module、service、型別、interface 或函式簽名，以及為何使用它們。若沒有 runtime interface 或 dependency 變更，也要明確寫出沒有。

## 修訂要求

每次修訂 ExecPlan 時，必須確認變更已反映到所有相關 sections，尤其是 `Progress`、`Decision Log`、`Artifacts and Notes` 與 `Outcomes & Retrospective`。若計畫內容改變方向或新增重要限制，請在 `Decision Log` 寫下原因。ExecPlan 必須描述「做什麼」以及「為什麼」，並維持自足、自給、新手可執行、結果導向。
