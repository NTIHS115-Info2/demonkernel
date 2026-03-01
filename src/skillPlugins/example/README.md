# Plugin README Template (Skill/System 通用)

此文件是 `src/skillPlugins/example` 的說明，也可作為新插件 README 模板。

## 1. 基本資訊

| 欄位 | 範例 |
| --- | --- |
| Plugin Name | `example` |
| Plugin Type | `skill` |
| Version | `0.0.1` |
| Entry | `index.js` |

## 2. 目錄

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

## 3. Manifest 規格

```json
{
  "meta": {
    "name": "example",
    "version": "0.0.1",
    "type": "skill",
    "entry": "index.js"
  },
  "runtime": {
    "startupWeight": 0,
    "method": ["local", "remote"],
    "onlineOptions": {
      "oneOf": []
    }
  },
  "dependencies": {
    "skill": {},
    "system": {}
  }
}
```

注意：`runtime.priority` 已淘汰，不可再使用。

## 4. Lifecycle 契約（throw-only）

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<{ status: StateCode }>`
- `send(options): Promise<unknown>`

失敗時直接 throw，由 PluginsManager 統一處理。

## 5. Strategy 分層

- Root plugin 負責 method 路由與對外契約。
- Strategy 負責 local/remote 具體邏輯。

## 6. 新增 method 流程

1. 新增 `strategies/{method}/index.ts`。
2. 更新 `strategies/index.ts` 匯出。
3. 更新 manifest `runtime.method` + `runtime.onlineOptions.oneOf`。
4. 更新 root `mode` 型別。

## 7. 驗收清單

1. `yarn build` 成功。
2. `online -> state -> send -> offline` 可運作。
3. 依賴與版本設定正確。
4. README 與 manifest 同步。

## 參考

- [`docs/plugins/overview.md`](../../../docs/plugins/overview.md)
- [`docs/plugins/plugin-sdk.md`](../../../docs/plugins/plugin-sdk.md)
- [`docs/pluginsManager/overview.md`](../../../docs/pluginsManager/overview.md)
