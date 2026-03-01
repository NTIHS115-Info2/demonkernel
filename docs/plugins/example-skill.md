# Example Skill Plugin 導讀

本文件說明 [`src/skillPlugins/example`](../../src/skillPlugins/example) 在新版 throw-only 契約下的結構。

## 1. 檔案

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

## 2. manifest 重點

檔案：[`src/skillPlugins/example/plugin.manifest.json`](../../src/skillPlugins/example/plugin.manifest.json)

- `meta.type = "skill"`
- `runtime.startupWeight`
- `runtime.method = ["local", "remote"]`
- `runtime.onlineOptions.oneOf`：方法對應 options schema
- `dependencies.skill/system`：精確版本依賴

## 3. Root Plugin (`index.ts`)

檔案：[`src/skillPlugins/example/index.ts`](../../src/skillPlugins/example/index.ts)

- `mode` 記錄當前 strategy。
- `online/restart` 依 `options.method` 決定 strategy。
- `offline/state/send` 轉送到目前 strategy。
- 失敗直接 throw（不回傳 `{ ok:false }`）。

## 4. Strategy

- Router：[`strategies/index.ts`](../../src/skillPlugins/example/strategies/index.ts)
- Local：[`strategies/local/index.ts`](../../src/skillPlugins/example/strategies/local/index.ts)
- Remote：[`strategies/remote/index.ts`](../../src/skillPlugins/example/strategies/remote/index.ts)

各 strategy 實作相同 lifecycle 介面，`state()` 回傳 `{ status }`。

## 5. 建立新插件最小步驟

1. 複製 `example` 目錄。
2. 更新 `plugin.manifest.json` 的 `name/version/type/startupWeight/dependencies`。
3. 實作 `online/offline/restart/state/send`，錯誤直接 throw。
4. 執行 `yarn build`，確認 `dist/.../plugin.manifest.json` 與 entry 正確。

## 6. 相關文件

- Plugins 總覽：[`docs/plugins/overview.md`](./overview.md)
- Plugin SDK：[`docs/plugins/plugin-sdk.md`](./plugin-sdk.md)
- PluginsManager：[`docs/pluginsManager/overview.md`](../pluginsManager/overview.md)
