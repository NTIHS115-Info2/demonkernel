# systemPlugins/system-prompt-manager

`system-prompt-manager` 是最小化的 system prompt provider plugin。它不驗證、不排序、不處理安全策略、不管理版本，也不自行定義或判斷有哪些 state。它唯一的 runtime 職責，是依照其他 plugin 傳入的 state 尋找對應檔案，並回傳 system prompt。

## Capability

- `system.prompt.manager.get` -> `getSystemPrompt({ state })`

## v0.1 範圍

- state 來源：由呼叫端傳入；目前 TalkEngine v0.7.2 固定傳入 `common`
- prompt 檔案命名：`assets/prompts/{state}.system.prompt.md`
- 預設 common prompt 檔案路徑：`assets/prompts/common.system.prompt.md`
- 預設 fallback prompt 檔案路徑：`assets/prompts/default.system.prompt.md`
- prompt 內容檔不提交到 repository；本機或部署環境需自行提供 `.system.prompt.md` 檔案，或透過 `promptDir` 指向受控目錄
- 回傳型別：`string`
- state 缺失、state 找不到對應 prompt 檔案或 prompt 檔案讀取失敗時：讀取 `default.system.prompt.md` 並寫出 `logger.warn`

## Local Options

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定為 local |
| `promptDir` | `string` | No | 覆寫 prompt 目錄，主要用於本機測試或受控部署 |

## Prompt 檔案

在本機或部署環境建立 `assets/prompts/common.system.prompt.md` 即可自訂 `common` system prompt；該類 prompt 內容檔預設被 `.gitignore` 排除，避免把實際提示詞內容提交到 repository。若未來上游傳入其他 state，例如 `support`，本 plugin 會尋找 `assets/prompts/support.system.prompt.md`。找不到對應 state 檔案時，會改讀 `assets/prompts/default.system.prompt.md`；建立或修改 default 檔案即可調整 fallback prompt。local strategy 會在每次 `getSystemPrompt()` 呼叫時重新讀取 prompt 檔案，因此檔案變更會直接影響後續呼叫，不需要重啟 plugin。

## 邊界

TalkEngine 負責選擇 state，並在目前版本固定傳入 `state: "common"`。本 plugin 不檢查 conversation state、不硬編可用 state 清單、不改變 TalkEngine flow，也不直接修改 LLM gateway payload。
