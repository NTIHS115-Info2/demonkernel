# Plugin README Template (Skill/System 通用)

本文件同時具備兩個用途：
1. 說明 `src/skillPlugins/example` 的實作架構。
2. 作為未來新插件 README 的標準填寫模板（可直接複製本結構）。

## 1. 基本資訊

必填欄位範例

| 欄位 | 說明 | 範例 |
| --- | --- | --- |
| Plugin Name | 插件名稱（通常對應資料夾名） | `example` |
| Plugin Type | `skill` 或 `system` | `skill` |
| Version | 插件版本 | `0.0.1` |
| Maintainer | 維護者（人員或團隊） | `Demonkernel Team` |
| Entry | 編譯後入口檔名 | `index.js` |

example 當前值

| 欄位 | 值 |
| --- | --- |
| Plugin Name | `example` |
| Plugin Type | `skill` |
| Version | `0.0.1` |
| Maintainer | `N/A`（待補） |
| Entry | `index.js` |

## 2. 目錄結構

必填欄位範例

```text
{plugin-name}/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/index.ts
    remote/index.ts
```

example 當前值

```text
example/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/index.ts
    remote/index.ts
```

檔案責任

| 檔案 | 責任 |
| --- | --- |
| `plugin.manifest.json` | 描述插件 meta/runtime/dependencies/io 規格 |
| `index.ts` | 插件 root lifecycle 實作，根據 `method` 分派 strategy |
| `strategies/index.ts` | strategy 索引（local/remote 路由） |
| `strategies/local/index.ts` | local strategy 行為 |
| `strategies/remote/index.ts` | remote strategy 行為 |

## 3. 架構設計

必填欄位範例

1. Root plugin 持有目前 `mode`（如 `local` / `remote`）。
2. `online/restart` 依輸入 `options.method` 決定使用哪個 strategy。
3. `offline/state/send` 走目前 `mode` 對應 strategy。
4. Strategy 僅負責特定執行方法，Root 負責對外生命週期契約。

example 當前值

1. `mode` 預設為 `"local"`。
2. `online(options)` 會呼叫 `strategies[options.method].online(options)`。
3. `restart(options)` 會呼叫 `strategies[options.method].restart(options)` 並更新 `mode`。
4. `state()/send()/offline()` 走 `strategies[mode]`。

## 4. Manifest 規範

必填欄位範例

```json
{
  "meta": {
    "name": "plugin-name",
    "version": "0.0.1",
    "type": "skill",
    "description": "plugin description",
    "entry": "index.js"
  },
  "runtime": {
    "priority": 0,
    "method": ["local", "remote"],
    "onlineOptions": {
      "oneOf": []
    },
    "errorCode": {}
  },
  "dependencies": {
    "system": {},
    "skill": {}
  },
  "io": {
    "input": {},
    "output": {},
    "examples": []
  }
}
```

example 當前值

- `meta.type = "skill"`
- `runtime.method = ["local", "remote"]`
- `runtime.onlineOptions.oneOf` 針對 local/remote 各有一份 schema
- `io.examples` 提供 `{ text: "hello" } -> { reply: "world" }`

## 5. 生命週期介面

必填欄位範例

| 方法 | 輸入 | 輸出 |
| --- | --- | --- |
| `online(options)` | `OnlineOptions` | `Promise<OnlineResult<void>>` |
| `offline()` | 無 | `Promise<OfflineResult<void>>` |
| `restart(options)` | `RestartOptions` | `Promise<RestartResult<void>>` |
| `state()` | 無 | `Promise<StateResult<{ status: StateCode }>>` |
| `send(options)` | `SendOptions` | `Promise<SendResult<void>>` |

example 當前值

- `online/restart` 會檢查 `options.method` 是否存在。
- `state()` 由 strategy 回報 `status`（`1` online、`0` offline）。
- `send()` 目前示範為記錄 log，回傳 `ok: true`。

## 6. 錯誤處理規範

必填欄位範例

1. 所有 lifecycle 方法都用 `try/catch` 包住。
2. 失敗時用 `makeError(CoreErrorCode.<CODE>, message, cause)` 統一回傳。
3. 由 Root plugin 負責把 strategy 例外轉成標準錯誤格式。

example 當前值

- `online` 失敗：`CoreErrorCode.ONLINE_FAILED`
- `offline` 失敗：`CoreErrorCode.OFFLINE_FAILED`
- `restart` 失敗：`CoreErrorCode.RESTART_FAILED`
- `send` 失敗：`CoreErrorCode.RUNNING_FAILED`

## 7. 新增策略流程

必填欄位範例

1. 新增 `strategies/{method}/index.ts`。
2. 更新 `strategies/index.ts` 匯出新 strategy。
3. 更新 `plugin.manifest.json`：
   - `runtime.method` 加上新 method。
   - `runtime.onlineOptions.oneOf` 新增對應 schema。
4. 更新 Root `index.ts` 的 `mode` 型別聯集。
5. 補齊 README 說明與測試。

example 當前值

目前已實作 `local` 與 `remote` 兩種 strategy，Root `mode` 型別為 `"local" | "remote"`。

## 8. 驗收清單

必填欄位範例

1. `yarn build` 可成功編譯與複製 `plugin.manifest.json`。
2. `online -> state -> send -> offline` 可執行。
3. 傳入無效 `method` 時可得到預期錯誤。
4. README 與 manifest/schema 同步。

example 當前值

1. 已具備 local/remote 上下線、重啟、狀態、send 示範。
2. `online/restart` 有檢查 `options.method`。
3. 錯誤碼已對齊 `CoreErrorCode`。

## 9. 常見陷阱

1. `runtime.method` 宣告了 method，但 `onlineOptions.oneOf` 沒有對應 schema。
2. `strategies/index.ts` 忘記 export 新 strategy，導致執行期找不到。
3. Root `mode` 型別沒有更新，造成 TS 型別或執行路由錯誤。
4. `state()` 回傳格式不符合 `StateResult<{ status: StateCode }>`。
5. `manifest.meta.entry` 與實際編譯輸出檔名不一致。

## 參考文件

- 插件系統總覽：[`docs/plugins/overview.md`](../../../docs/plugins/overview.md)
- skill example 導讀：[`docs/plugins/example-skill.md`](../../../docs/plugins/example-skill.md)
- plugin-sdk 參考：[`docs/plugins/plugin-sdk.md`](../../../docs/plugins/plugin-sdk.md)