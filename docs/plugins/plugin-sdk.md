# Plugin SDK 參考文件

本文件對應 [`src/core/plugin-sdk`](../../src/core/plugin-sdk) 現行實作，說明對外型別、錯誤模型與驗證邏輯。

## 1. 檔案結構

```text
src/core/plugin-sdk/
  index.ts
  types.ts
  errors.ts
  manifest.ts
```

- `index.ts`：SDK 對外匯出入口。
- `types.ts`：插件型別、manifest 型別、lifecycle 型別。
- `errors.ts`：核心錯誤碼與 `makeError`。
- `manifest.ts`：manifest/online options 驗證工具。

## 2. `types.ts` 對外能力

檔案：[`src/core/plugin-sdk/types.ts`](../../src/core/plugin-sdk/types.ts)

### 2.1 核心型別

- `PluginType = "skill" | "system"`
- `OnlineMethod = "local" | "remote"`
- `PluginError = { code; message; cause? }`

### 2.2 Manifest 型別

- `PluginManifest.meta`
  - `name/version/type/entry` 必填
  - `description` 可選
- `PluginManifest.runtime`
  - `priority`（number）
  - `method`（`OnlineMethod[]`）
  - `onlineOptions.oneOf`（method 對應 schema）
  - `errorCode`（可選）
- `PluginManifest.dependencies`（可選）
  - `system?: Record<string, string>`
  - `skill?: Record<string, string>`

### 2.3 Lifecycle 型別

- 輸入型別：`OnlineOptions`、`RestartOptions`、`SendOptions`
- 輸出型別：`OnlineResult<T>`、`OfflineResult<T>`、`RestartResult<T>`、`SendResult<T>`
- 狀態型別：`StateCode` 與 `StateResult<T>`
- 介面：
  - `IStrategy`
  - `IPlugin`

## 3. `errors.ts` 對外能力

檔案：[`src/core/plugin-sdk/errors.ts`](../../src/core/plugin-sdk/errors.ts)

### 3.1 CoreErrorCode 對照

| Error Code | 建議使用時機 |
| --- | --- |
| `MANIFEST_INVALID` | manifest 格式錯誤、欄位不完整 |
| `METHOD_NOT_ALLOWED` | method 不在 `runtime.method` |
| `OPTIONS_INVALID` | online options 缺欄位或型別錯誤 |
| `STRATEGY_NOT_FOUND` | 找不到 method 對應 strategy |
| `LIFECYCLE_INVALID` | lifecycle 狀態錯誤 |
| `ONLINE_FAILED` | `online` 執行失敗 |
| `OFFLINE_FAILED` | `offline` 執行失敗 |
| `RESTART_FAILED` | `restart` 執行失敗 |
| `RUNNING_FAILED` | `send` 或執行期流程失敗 |

### 3.2 `makeError`

`makeError(code, message, cause?)` 回傳標準 `PluginError`，建議在每個 lifecycle `catch` 使用。

## 4. `manifest.ts` 驗證邏輯

檔案：[`src/core/plugin-sdk/manifest.ts`](../../src/core/plugin-sdk/manifest.ts)

### 4.1 `validateManifest(manifest)`

驗證規則：
1. `meta.name/version/type/entry` 必填。
2. `runtime.priority` 必須是 number。
3. `runtime.method` 必須是非空陣列。
4. `runtime.method` 成員值僅允許 `local` 或 `remote`。
5. 若有 `onlineOptions`：
   - `oneOf` 必須是非空陣列。
   - 每個 `when.method` 必須合法且存在於 `runtime.method`。
   - 每個 `schema` 必須存在且為 object。
   - schema 必須包含 `method` 欄位。

### 4.2 `validateOnlineOptions(manifest, options)`

驗證規則：
1. `options.method` 必填。
2. `options.method` 必須在 `manifest.runtime.method` 內。
3. 必須找到該 method 對應的 schema。
4. 逐欄位檢查 schema 定義欄位：
   - 型別需匹配（string/number/boolean/object）
   - 若有 `enum`，值必須落在 enum 中
   - 非 optional 欄位不可缺失

## 5. `index.ts` 匯出

檔案：[`src/core/plugin-sdk/index.ts`](../../src/core/plugin-sdk/index.ts)

行為：
- 重新匯出 `types`、`errors`、`manifest`。
- 插件端通常透過 `@core/plugin-sdk` 一次取得型別與工具函式。

## 6. Known Gaps (as-is)

以下是目前程式與理想規格的已知落差，本文僅記錄，不在本次任務修正：

1. `plugin.manifest.json` 使用了 `io`，但 `PluginManifest` 型別未定義 `io` 欄位。
2. `IPlugin` 介面包含 `manifest`，但目前啟動載入流程只硬檢查 `online/offline`。
3. `StateResult` 目前只有成功分支，未定義錯誤分支。
4. `validateOnlineOptions` 目前只驗 schema 內欄位，不會阻擋額外欄位。

## 7. 相關文件

- 插件總覽：[`docs/plugins/overview.md`](./overview.md)
- skill example 導讀：[`docs/plugins/example-skill.md`](./example-skill.md)
- example README 模板：[`src/skillPlugins/example/README.md`](../../src/skillPlugins/example/README.md)
