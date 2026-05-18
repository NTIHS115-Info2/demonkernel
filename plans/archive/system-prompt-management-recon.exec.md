# System Prompt Manager Plugin Implementation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained according to `.agent/PLANS.md`.

Target Version: v0.17.0

## Purpose / Big Picture

本計畫原本完成 repository-wide reconnaissance，確認 Demonkernel 目前沒有真正的 system prompt management。現在延伸為 v0.17.0 正式實作：新增 `system-prompt-manager` system plugin，讓 TalkEngine 在送出 LLM request 前取得 `common` 狀態的 system prompt，並把它放入 messages 第一筆。

本次 v0.1 的「manager」只代表可透過檔案提供與自訂 system prompt。它不是 prompt policy engine，不做 prompt 驗證、安全審查、版本治理、狀態判斷或 TalkEngine 流程控制。完成後，維護者可在本機或部署環境提供 `src/systemPlugins/system-prompt-manager/assets/prompts/common.system.prompt.md`，或透過 `promptDir` 指向受控目錄，來影響 TalkEngine 後續送往 LLM 的 system prompt。prompt 內容檔不提交到 repository。

## Progress

- [x] (2026-05-17 22:44 +08:00) 閱讀 `.agent/PLANS.md`，確認本任務需要維護 active ExecPlan，並綁定 `Target Version: v0.17.0`。
- [x] (2026-05-17 22:44 +08:00) 確認 `plans/active/` 目前沒有既有 active ExecPlan，且 `git status --short` 起始為乾淨。
- [x] (2026-05-17 22:44 +08:00) 建立本 reconnaissance ExecPlan，先記錄目的、範圍、分工與驗證方式。
- [x] (2026-05-17 22:44 +08:00) 建立 `Updates/Main/v0/v0.17/v0.17.0.md`，記錄 v0.17.0 系統提示詞管理偵察準備階段。
- [x] (2026-05-17 22:54 +08:00) 啟動四個 subagent 掃描 runtime/system plugins、core contracts、tests/fixtures、docs/Updates，並取得具體檔案與證據回報。
- [x] (2026-05-17 22:54 +08:00) 主 agent 直接閱讀 `promptComposer.ts`、`talk-engine` local strategy/input/types、`llm-remote-gateway` validator/payload/types、`conversation-history` storage、core plugin SDK/capability types、README 與 UpdateLog，驗證 subagent 結論。
- [x] (2026-05-17 22:54 +08:00) 在本 ExecPlan 的 `Surprises & Discoveries`、`Artifacts and Notes` 與 `Outcomes & Retrospective` 記錄最終答案與後續建議。
- [x] (2026-05-17 23:46 +08:00) 依 Notion 規格與使用者確認決策，將本 ExecPlan 轉為 v0.17.0 implementation plan；鎖定 plugin name、prompt file lookup path、缺檔 fallback 與 TalkEngine common state 接入。
- [x] (2026-05-17 23:58 +08:00) 啟動測試腳本、插件架構、概念驗證 subagents；因回覆未在可用時間內完成，已關閉 subagents 並由主 agent 依既有 source/test pattern 完成實作。
- [x] (2026-05-17 23:58 +08:00) 實作 `system-prompt-manager` local provider、capability binding、README、manifest、asset prompt 與 plugin-specific UpdateLog。
- [x] (2026-05-17 23:58 +08:00) 將 TalkEngine 加入 `system-prompt-manager@0.1.0` dependency，並在 request flow 中插入 `common` system prompt。
- [x] (2026-05-17 23:58 +08:00) 執行 focused system plugin tests、pluginsManager tests、build 與 lint，並把結果寫入本計畫與 UpdateLogs。
- [x] (2026-05-18 00:00 +08:00) 將 `system-prompt-manager` README 改為中文；此後續文件補強歸入 patch update `v0.17.1`。
- [x] (2026-05-18 00:12 +08:00) 以 `v0.17.1` 修正 prompt manager 內部 hard-coded state enum，改為依上游傳入 state 尋找 `{state}.system.prompt.md`，找不到時 warn 並回傳 default prompt。
- [x] (2026-05-18 01:05 +08:00) 完成 `v0.17.1` 驗證：focused system plugin tests、pluginsManager tests、build 與 lint 皆通過。
- [x] (2026-05-18 01:20 +08:00) 以 `v0.17.2` 將 default prompt 改為 `default.system.prompt.md` 檔案，fallback 時讀取該檔案，只有 default 檔也不可用時才使用 emergency fallback。
- [x] (2026-05-18 01:23 +08:00) 完成 `v0.17.2` 驗證：focused system plugin tests、pluginsManager tests、build 與 lint 皆通過。
- [x] (2026-05-18 +08:00) 依未提交變更 review 結果修正計畫與文檔：prompt 內容檔確認不提交，README/UpdateLogs 改為描述本機或部署環境提供 prompt 檔，`.gitignore` 保留 prompt 內容排除規則並補 final newline。
- [x] (2026-05-19 +08:00) 使用者提供 startup log，確認預設 core startup 只啟動 gateway、discord、conversation-history、talk-engine，漏啟動 `system-prompt-manager`，導致 TalkEngine dependency evaluation 失敗。
- [x] (2026-05-19 +08:00) 修正 core startup sequence，在 `talk-engine` 前啟動 `system-prompt-manager`，並更新 startup integration test 與 v0.17.3 UpdateLog。
- [x] (2026-05-19 +08:00) 驗證 startup regression fix：`yarn test tests/pluginsManager/index.integration.test.ts`、`yarn test tests/pluginsManager` 與 `yarn build` 皆通過。

## Surprises & Discoveries

- Observation: Windows sandboxed PowerShell runner 在第一次唯讀命令上回傳 `CreateProcessAsUserW failed: 5`。
  Evidence: 讀取 `.agent/PLANS.md`、列出 `plans/active` 與 `git status --short` 的初始 sandboxed 命令都失敗；改用經使用者授權的 escalated 唯讀命令後成功。

- Observation: repository 內沒有命中真正的 system prompt management 術語或 contract。
  Evidence: `rg -n -i "system prompt|system-prompt|system_prompt|systemPrompt|prompt manager|prompt registry|prompt template|template loader|developer instruction" .` 除本計畫、v0.17.0 UpdateLog 與舊 UpdateLog 限制說明外，沒有 production source 命中。

- Observation: 現有最接近的機制是 `talk-engine` 內建 Prompt Composer，但它只組 `recent history + current user message`。
  Evidence: `src/systemPlugins/talk-engine/strategies/local/promptComposer.ts` 的 `composePromptMessages()` 只前置已清洗 history 並追加一筆 `role: "user"` message；`src/systemPlugins/talk-engine/README.md` 第 27-31 行也把邊界定義為 recent history 與 current user message。

- Observation: `system` role 目前可以被轉送或儲存，但沒有集中定義、版本化、覆寫或注入來源。
  Evidence: `TalkPromptMessage` 與 `ConversationRole` 都允許 `system | user | assistant | tool`；`llm-remote-gateway` 的 `VALID_ROLES` 允許 `system`。這些只是 role validation/history replay，不是 prompt registry 或 template manager。

- Observation: 目前 `yarn build` 會複製 `src/**/plugin.manifest.json` 與 `src/**/assets/**` 到 `dist`。
  Evidence: `package.json` 的 `copy:assets` script 是 `cpy "src/**/plugin.manifest.json" "src/**/assets/**" "dist" --parents`；因此 prompt 檔放在 `assets/prompts/` 可避免修改 build pipeline。

- Observation: Concept implementation path is feasible without changing `llm-remote-gateway` or core plugin SDK contracts.
  Evidence: `system-prompt-manager` exposes a standard system capability binding; TalkEngine resolves `system.prompt.manager.get` through the existing capability registry and passes the resulting string into `composePromptMessages()` before `buildGatewayPayload()`.

- Observation: Subagents were useful for the planned division of responsibility, but their results did not return before implementation needed to proceed.
  Evidence: The test, skeleton, and concept subagents were started and later closed; final production edits were made by the main agent after directly reading the related source files.

- Observation: The original asset-commit design conflicted with the desired repository boundary for prompt content.
  Evidence: Review found `common.system.prompt.md` and `default.system.prompt.md` present in the working tree but ignored by `.gitignore`; user confirmed prompt content should not be committed.

- Observation: `talk-engine` manifest dependency is correct, but default kernel startup did not start `system-prompt-manager`.
  Evidence: User-provided log at `2026-05-18T17:35:33Z` reports `dependency system:system-prompt-manager is offline and not in startup queue`; `src/index.ts` core flow started `system:llm-remote-gateway`, `system:discord`, `system:conversation-history`, then `system:talk-engine`.

## Decision Log

- Decision: 將本任務建成新的 active ExecPlan，Target Version 固定為 `v0.17.0`。
  Rationale: 使用者明確指定準備階段與後續正式修改前都視為 0.17.0；`.agent/PLANS.md` 要求新的 ExecPlan 開始前綁定 target version，且每次停下前更新 living sections。
  Date/Author: 2026-05-17 / Codex

- Decision: 本階段只做偵察、文件與 UpdateLog，不修改 runtime behavior。
  Rationale: 使用者要求「分析整份專案」與找出是否已有管理系統提示詞的東西，尚未要求正式實作。先建立 repo-wide inventory 可以降低後續 0.17.0 設計誤判風險。
  Date/Author: 2026-05-17 / Codex

- Decision: 使用 subagent 平行探索，但最終結論必須由主 agent 直接閱讀關鍵 source files 後整合。
  Rationale: 使用者明確允許並建議使用 subagent；`.agent/PLANS.md` 也提醒 reconnaissance reports 只是導覽輔助，不能取代 production source 驗證。
  Date/Author: 2026-05-17 / Codex

- Decision: 將「Prompt Composer」分類為 message assembly，不分類為 system prompt management。
  Rationale: 它沒有 system prompt 設定來源、template id、版本、override、registry 或 plugin contract；它只接受現有 history messages 並追加目前 user message。舊 UpdateLog 也明確說 v0.12.0 / talk-engine v0.3.0 不含 system prompt 擴充。
  Date/Author: 2026-05-17 / Codex

- Decision: 新插件正式命名為 `system-prompt-manager`，提供 `system.prompt.manager.get` capability。
  Rationale: 使用者在 Plan Mode 中選擇 `system-prompt-manager`；此命名符合 repository 現有 kebab-case system plugin pattern，capability id 使用 dot namespace。
  Date/Author: 2026-05-17 / Codex

- Decision: `common` prompt lookup path 使用 `src/systemPlugins/system-prompt-manager/assets/prompts/common.system.prompt.md`。
  Rationale: 使用者選擇 `assets/prompts`；此路徑符合 plugin asset layout。後續 review 決定 prompt 內容檔不提交，因此該路徑代表本機或部署環境提供的檔案位置，而不是 repository 內建內容。
  Date/Author: 2026-05-17 / Codex

- Decision: 缺少 requested prompt 檔時回傳 fallback prompt 並寫 `logger.warn`，provider 對外仍只回傳 string。
  Rationale: 使用者指定缺檔時使用預設 system prompt 並回傳 warn，接著確認 API 採 `String + log`；v0.17.2 後 fallback 先讀 `default.system.prompt.md`，該檔也不可用才使用 emergency fallback。這保持 v0.1 provider interface 簡單，warning 由 logger 承擔。
  Date/Author: 2026-05-17 / Codex

- Decision: Prompt manager 不定義 state 清單，也不將 `common` hard-code 為唯一合法 state。
  Rationale: state 是由 TalkEngine 等上游決定並傳入；prompt manager 的責任是根據 state 尋找對應 prompt 檔案並回傳字串。找不到檔案時 warn 並回 default，避免未來新增 state 時需要修改 manager code 或造成使用誤解。
  Date/Author: 2026-05-18 / Codex

- Decision: default prompt 也透過 `assets/prompts/default.system.prompt.md` 檔案路徑提供。
  Rationale: 使用者指出 default prompt 也應採用與普通 system prompt 相同的儲存方式，方便修改並避免後續維護者誤以為 fallback 需要改 code。後續 review 決定 prompt 內容檔不提交，因此 default prompt 內容同樣由本機或部署環境提供。
  Date/Author: 2026-05-18 / Codex

- Decision: Prompt content files remain ignored and are not committed.
  Rationale: The earlier plan to commit `common.system.prompt.md` and `default.system.prompt.md` would make real prompt content part of source control and conflicted with the user's explicit decision. The final design commits only the plugin code, manifest, README, tests, `.gitkeep`, and `.gitignore` rule; runtime prompt files are supplied by local or deployment environments, or by configuring `promptDir`.
  Date/Author: 2026-05-18 / Codex

- Decision: Default kernel startup must online `system-prompt-manager` before `system:talk-engine`.
  Rationale: TalkEngine now has an exact dependency on `system-prompt-manager@0.1.2`. Starting TalkEngine without first starting the prompt manager leaves the dependency offline and outside the single-plugin startup queue, causing the dependency evaluator to block startup.
  Date/Author: 2026-05-19 / Codex

## Outcomes & Retrospective

Repository-wide reconnaissance 已完成。結論：目前沒有真正的 system prompt management。沒有 `PromptManager`、`PromptRegistry`、`SystemPromptProvider`、prompt template loader、manifest `systemPrompt` / `prompts` 欄位、`system.prompt.*` capability contract、developer instruction 管理層、版本化 prompt 或 override API。

現有能力分成三類。第一類是 `talk-engine` 的 Prompt Composer：`src/systemPlugins/talk-engine/strategies/local/promptComposer.ts` 會把已清洗 history messages 前置，再加入目前 user message。第二類是 `llm-remote-gateway` 的 OpenAI-compatible message validation/transport：它允許 `system` role 並清理 forbidden fields，但不產生或管理 prompt。第三類是 `conversation-history` 的 transcript storage：它可保存 `system` role message，但沒有把 system prompt 當設定或 template 管理。

v0.17.0 實作已採用保守邊界：新增 prompt provider contract 與 focused tests，讓 `talk-engine` 在 `composePromptMessages()` 之前取得 system prompt；未把任意 system prompt 字串藏在 `params`、history fixture 或 gateway transport layer。

Implementation target 已鎖定為最小 v0.1 provider，驗收重點是「TalkEngine messages 第一筆為 common system prompt」且 prompt manager 不承擔 validation/policy/version governance。

Implementation 已完成。`system-prompt-manager@0.1.2` 會依上游傳入 state 讀取 `assets/prompts/{state}.system.prompt.md`，缺檔或讀取失敗時讀取 `assets/prompts/default.system.prompt.md` 並寫 warning。TalkEngine v0.7.2 使用 exact dependency `system-prompt-manager@0.1.2`，每次 request 在送往 LLM gateway 前固定呼叫 `getSystemPrompt({ state: "common" })`，並把回傳字串作為 messages 第一筆 `{ role: "system" }`。LLM gateway 未修改。

Review follow-up changed the packaging boundary: prompt content files are intentionally not committed. The previous design assumed `common.system.prompt.md` and `default.system.prompt.md` would be repository assets copied by `yarn build`; that does not fit the user's requirement because prompt content should stay local or deployment-specific. The final design keeps the file naming and lookup behavior, but `.system.prompt.md` content files are ignored, and operators provide them in `assets/prompts/` or through `promptDir`.

Validation complete: focused system plugin tests、pluginsManager tests、build 與 lint 都通過。lint 仍回報既有 `tests/systemPlugins/discord.test.ts` unused variable warning，但 exit code 為 0，且該檔案不屬於本次修改。

v0.17.1 validation complete: focused system plugin tests 目前為 3 files / 21 tests passed；pluginsManager 為 6 files / 36 tests passed；build 通過。pluginsManager 有 logger cleanup stderr warning，lint 有既有 Discord test unused variable warning，兩者 exit code 都是 0。

v0.17.2 validation complete: focused system plugin tests 目前為 3 files / 23 tests passed；pluginsManager 為 6 files / 36 tests passed；build 通過。pluginsManager 有 logger cleanup stderr warning，lint 有既有 Discord test unused variable warning，兩者 exit code 都是 0。

v0.17.3 startup regression fix complete: default kernel startup now onlines `system:system-prompt-manager` before `system:talk-engine`. `yarn test tests/pluginsManager/index.integration.test.ts` passed with 1 file / 5 tests, `yarn test tests/pluginsManager` passed with 6 files / 36 tests, and `yarn build` passed.

## Context and Orientation

Demonkernel 是 TypeScript Node runtime，核心程式在 `src/`，測試在 `tests/`，正式文件在 `docs/`，更新紀錄在 `Updates/`。核心 plugin runtime 位於 `src/core/pluginsManager`，plugin SDK contract 位於 `src/core/plugin-sdk`，capability definitions 位於 `src/core/capabilities`，provider lookup 位於 `src/core/registry`。和提示詞最可能相關的區域包括 conversation flow、LLM gateway、talk engine、system plugins、capability providers、tests fixtures 與 docs。

本計畫使用下列白話定義：

- system prompt：送進 LLM request 的高優先級指令文字，通常是 role 為 `system` 的 message，或在 provider request 中等價的 instruction 欄位。
- prompt management：集中維護 prompt 的機制，例如 registry、manager、template file loader、版本欄位、override API、validation、plugin-provided prompt fragments 或 capability-based prompt provider。
- hard-coded prompt：散落在 source/test 中的字串，會影響模型行為，但沒有集中管理、版本化或可替換邊界。
- reconnaissance report：subagent 探索後提供的檔案與發現摘要，只作為導覽，正式結論仍需主 agent 讀 source 驗證。

## Plan of Work

Implementation 會先把 tests 與 plugin skeleton 分開處理，避免先寫完整實作後才回頭補測試。測試 subagent 負責新增 prompt manager focused tests 與 TalkEngine 接入斷言；插件架構 subagent 負責建立 `system-prompt-manager` 的 manifest、README、index/types/strategy、prompt directory placeholder 與 dependency order 檢查；概念驗證 subagent 先確認 prompt file 讀取與 capability provider 接法可行，並把限制寫回本計畫。

正式實作時，`system-prompt-manager` local strategy 每次 `getSystemPrompt({ state: "common" })` 都讀取 `assets/prompts/common.system.prompt.md`，但該 prompt 內容檔不提交，由本機或部署環境提供。原方案打算把 `common.system.prompt.md` 和 `default.system.prompt.md` 當作 repository asset 一起提交，問題是 prompt 內容會進入 source control，且和使用者要求「prompt 內容設定為不提交上去」衝突。最終設計保留 `assets/prompts/{state}.system.prompt.md` 檔名規則與 `.gitkeep` 目錄 placeholder，並以 `.gitignore` 排除 `*.system.prompt.md`。

若 requested state 檔案不存在、為空或讀取失敗，local strategy 會透過 repository logger 記 `warn`，再嘗試讀取 `assets/prompts/default.system.prompt.md`。若 default prompt 檔案也不可用，才回傳內建 emergency fallback `Respond to the user request.`。TalkEngine 只新增最小接入：resolve `system.prompt.manager.get` provider，呼叫 `getSystemPrompt({ state: "common" })`，把非空 prompt 以 `{ role: "system", content }` 放在 messages 陣列最前面。LLM gateway 不改。

## Concrete Steps

在 repository root `E:\ai-training\demonkernel` 執行或維護：

    yarn updatelog:new

若互動式命令不適合本環境，改用等價命令檢查 CLI 用法後建立一筆 `Updates/Main` entry：

    node tools/updatelog/cli.js new

新增/更新檔案應包含：

    src/systemPlugins/system-prompt-manager/plugin.manifest.json
    src/systemPlugins/system-prompt-manager/index.ts
    src/systemPlugins/system-prompt-manager/README.md
    src/systemPlugins/system-prompt-manager/strategies/local/index.ts
    src/systemPlugins/system-prompt-manager/assets/prompts/.gitkeep
    .gitignore
    src/index.ts
    tests/systemPlugins/system-prompt-manager.test.ts
    tests/systemPlugins/talk-engine.test.ts
    tests/pluginsManager/index.integration.test.ts
    tests/pluginsManager/system-prompt-manager.integration.test.ts
    Updates/Plugins/system/system-prompt-manager/v0/v0.1/v0.1.0.md
    Updates/Plugins/system/talk-engine/v0/v0.7/v0.7.0.md
    Updates/Main/v0/v0.17/v0.17.3.md

驗證命令：

    yarn test tests/systemPlugins/system-prompt-manager.test.ts tests/systemPlugins/talk-engine.prompt-composer.test.ts tests/systemPlugins/talk-engine.test.ts
    -> PASS: v0.17.0 3 files, 19 tests; v0.17.1 3 files, 21 tests; v0.17.2 3 files, 23 tests

    yarn test tests/pluginsManager
    -> PASS: 6 files, 36 tests; rerun for v0.17.3 startup regression fix also passed

    yarn build
    -> PASS: tsc, tsc-alias, copy:assets; rerun for v0.17.3 startup regression fix also passed

    yarn lint
    -> PASS with one existing warning in tests/systemPlugins/discord.test.ts

## Validation and Acceptance

本實作階段完成時應滿足：

- `system-prompt-manager` 是可被 PluginsManager discovery/online 的 system plugin。
- `system.prompt.manager.get` capability provider 暴露 `getSystemPrompt()`；當本機或部署環境提供 `common.system.prompt.md` 時，`common` 會回傳該檔案 prompt 字串。
- 修改本機或部署環境中的 `common.system.prompt.md` 後，同一 runtime 後續呼叫會讀到新內容；不需要 restart 或 cache clear。
- prompt 內容檔不提交到 repository；`.gitignore` 排除 `src/systemPlugins/system-prompt-manager/assets/prompts/*.system.prompt.md`，repository 只保留 `.gitkeep` 作為目錄 placeholder。
- requested prompt 檔缺失時讀取 `default.system.prompt.md`，並呼叫 `logger.warn`；default 檔案也不可用時才使用 emergency fallback。
- TalkEngine request payload 的 messages 第一筆是 `role: "system"`，後面接 recent history 與 current user message。
- 目前 TalkEngine v0.7.2 固定傳入 `state: "common"`；PromptManager 不自行定義 state 清單，只依上游傳入 state 尋找對應 prompt 檔案。
- 預設 kernel startup flow 會在 `system:talk-engine` 前啟動 `system:system-prompt-manager`，避免 dependency evaluation 回報 prompt manager offline 且不在 startup queue。
- 不修改 LLM gateway，不引入 prompt validation/policy/version governance。

## Idempotence and Recovery

本實作為 additive plugin 與 TalkEngine 最小接入，可重跑 tests/build/lint。prompt 檔與 default prompt 檔讀取不 cache，重跑或修改檔案後不需清理 runtime state。prompt 內容檔不提交，因此乾淨 checkout 若未提供 prompt 檔會進入 default 或 emergency fallback；恢復方式是在本機或部署環境建立對應 state prompt 或 `default.system.prompt.md`，或設定 `promptDir` 指向已有 prompt 檔的目錄。若 integration 造成 TalkEngine online dependency failure，檢查 `talk-engine` manifest exact dependency 與 `system-prompt-manager` startupWeight/capability binding。

## Artifacts and Notes

初始證據：

    Get-Content -Path .agent/PLANS.md
    -> 成功讀到 ExecPlan 規範，包含必備 sections、Target Version 與 UpdateLog 要求。

    Get-ChildItem -Path plans/active -Filter *.exec.md
    -> 無輸出，表示建立本計畫前沒有 active ExecPlan。

    git status --short
    -> 無輸出，表示建立本計畫前工作樹乾淨。

    node tools/updatelog/cli.js new --category main --version 0.17.0 ...
    -> [updatelog] 已生成: Updates/Main/v0/v0.17/v0.17.0.md

Reconnaissance 證據摘錄：

    rg -n -i "system prompt|system-prompt|system_prompt|systemPrompt|prompt manager|prompt registry|prompt template|template loader|developer instruction" .
    -> production source 無 prompt manager/registry/template/developer instruction 命中；只看到本 v0.17.0 plan、v0.17.0 UpdateLog 與舊 UpdateLog 限制說明。

    src/systemPlugins/talk-engine/strategies/local/promptComposer.ts
    -> composePromptMessages(input) = normalized history + { role: "user", content: composePromptContent(input) }。

    src/systemPlugins/talk-engine/strategies/local/input.ts
    -> normalizeTalkInput() 沒有 systemPrompt、developerInstruction 或 templateId 欄位；buildGatewayPayload() 只放入 messages/model/tools/tool_choice/params 等 request fields。

    src/systemPlugins/llm-remote-gateway/strategies/remote/messageValidator.ts
    -> VALID_ROLES = ["system", "user", "assistant", "tool"]，但用途是清理與驗證 message。

    Updates/Main/v0/v0.12/v0.12.0.md
    -> Risks & Rollback 明確寫本版不含 system prompt/history/tool result 擴充，若追加需求需先定義新輸入契約。

Review follow-up evidence:

    git check-ignore -v src/systemPlugins/system-prompt-manager/assets/prompts/common.system.prompt.md src/systemPlugins/system-prompt-manager/assets/prompts/default.system.prompt.md
    -> .gitignore 排除 `src/systemPlugins/system-prompt-manager/assets/prompts/*.system.prompt.md`，符合 prompt 內容不提交的最終設計。

Startup regression evidence:

    2026-05-18T17:35:33.360Z WARN [plugins-manager] onlineMany failed during dependency evaluation
    -> dependency system:system-prompt-manager is offline and not in startup queue

    yarn test tests/pluginsManager/index.integration.test.ts
    -> PASS: 1 file, 5 tests

    yarn test tests/pluginsManager
    -> PASS: 6 files, 36 tests

    yarn build
    -> PASS: tsc, tsc-alias, copy:assets

## Interfaces and Dependencies

本實作新增 runtime-visible plugin interface，但不新增 npm package dependency。新增的 system capability 是 `system.prompt.manager.get`，由 `src/systemPlugins/system-prompt-manager/index.ts` 的 `getCapabilityBindings()` 註冊，provider method 為 `getSystemPrompt(input: { state: string }): Promise<string>`。`src/systemPlugins/system-prompt-manager/plugin.manifest.json` 宣告 `capabilities.provides` 與 `runtime.startupWeight`，並維持 system plugin 才能提供 capability 的既有規則。

TalkEngine 的 manifest 新增 exact dependency `system-prompt-manager@0.1.2`，local strategy 透過 capability registry resolve `system.prompt.manager.get`，在建立 LLM gateway payload 前呼叫 `getSystemPrompt({ state: "common" })`。外部 package dependency、LLM gateway provider contract、core plugin SDK 型別與 registry implementation 不需要修改。Repository tooling 維持 Yarn scripts、UpdateLog CLI、`rg`、PowerShell `Get-Content` 與 `git diff/status`。
