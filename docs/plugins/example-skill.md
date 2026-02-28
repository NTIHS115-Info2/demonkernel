# Example Skill Plugin 導讀

本文件逐檔說明 [`src/skillPlugins/example`](../../src/skillPlugins/example) 的設計，並提供建立新插件的實作清單。

## 1. 檔案導覽

```text
src/skillPlugins/example/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/index.ts
    remote/index.ts
```

## 2. `plugin.manifest.json`

檔案：[`src/skillPlugins/example/plugin.manifest.json`](../../src/skillPlugins/example/plugin.manifest.json)

重點：
- `meta`：插件名稱、版本、型別、入口。
- `runtime.method`：宣告允許方法（目前 `local`、`remote`）。
- `runtime.onlineOptions.oneOf`：依 method 定義上線 options schema。
- `runtime.errorCode`：插件自定義錯誤碼字典。
- `dependencies`：依賴的 system/skill 插件。
- `io`：輸入輸出格式與 example。

## 3. Root Plugin `index.ts`

檔案：[`src/skillPlugins/example/index.ts`](../../src/skillPlugins/example/index.ts)

重點：
- 透過 `mode: "local" | "remote"` 記錄目前 strategy。
- `online(options)`：
  - 檢查 `options.method`
  - 呼叫 `strategies[options.method].online(options)`
  - 成功後更新 `mode`
- `offline()`：呼叫 `strategies[mode].offline()`
- `restart(options)`：
  - 檢查 `options.method`
  - 呼叫 `strategies[options.method].restart(options)`
  - 成功後更新 `mode`
- `state()/send()`：轉送到目前 `mode` strategy
- 錯誤由 `makeError(CoreErrorCode.*, ...)` 統一包裝

## 4. Strategy Router `strategies/index.ts`

檔案：[`src/skillPlugins/example/strategies/index.ts`](../../src/skillPlugins/example/strategies/index.ts)

重點：
- 將 `local` 與 `remote` strategy 統一輸出為同一物件。
- Root plugin 可用 `strategies[method]` 動態選擇實作。

## 5. Strategy 實作（local / remote）

- Local：[`src/skillPlugins/example/strategies/local/index.ts`](../../src/skillPlugins/example/strategies/local/index.ts)
- Remote：[`src/skillPlugins/example/strategies/remote/index.ts`](../../src/skillPlugins/example/strategies/remote/index.ts)

共同特性：
- 內部維護 `state.online`。
- `online` 設為 `true`、`offline` 設為 `false`。
- `restart` 採 `offline -> online`。
- `state` 回傳 `status: 1`（online）或 `status: 0`（offline）。
- `send` 目前是示範型（log + 回傳 success）。

## 6. Mode 路由設計說明

路由分工：
- Root plugin 負責「對外契約」與「method 選擇」。
- Strategy 負責「method 內部行為」。

優點：
- root 介面固定，strategy 可獨立演進。
- 新增 method 時，只要新增一個 strategy 並更新 manifest/router。

## 7. 新插件建立步驟 Checklist

1. 複製 `src/skillPlugins/example` 成新資料夾。
2. 修改 `plugin.manifest.json` 的 `meta.name`、`description`、`dependencies`、`io`。
3. 檢查 `runtime.method` 與 `onlineOptions.oneOf` 一致。
4. 更新 `index.ts` 中 `mode` 聯集型別（若 method 有變）。
5. 在 `strategies/index.ts` 匯出所有 method 實作。
6. 實作每個 strategy 的 `online/offline/restart/state/send`。
7. 補完 README（可沿用模板：[`src/skillPlugins/example/README.md`](../../src/skillPlugins/example/README.md)）。
8. 執行 `yarn build`，確認 `dist/skillPlugins/{name}` 生成正確。

## 8. 可擴充點

- 可在 strategy 內加入真正的本地或遠端通訊行為。
- 可在 `send` 實作 I/O 協定映射（對齊 manifest `io` 定義）。
- 可在 plugin 級加入更細緻的 lifecycle 狀態管理（例如 starting/stopping/error）。

## 9. 相關文件

- 插件總覽：[`docs/plugins/overview.md`](./overview.md)
- SDK 細節：[`docs/plugins/plugin-sdk.md`](./plugin-sdk.md)
- System 對應範例：[`src/systemPlugins/example/README.md`](../../src/systemPlugins/example/README.md)
