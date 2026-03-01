# Plugin SDK 參考文件

本文件對應 [`src/core/plugin-sdk`](../../src/core/plugin-sdk) 的現行實作。

## 1. 檔案結構

```text
src/core/plugin-sdk/
  index.ts
  types.ts
  errors.ts
  manifest.ts
```

## 2. 型別重點

檔案：[`src/core/plugin-sdk/types.ts`](../../src/core/plugin-sdk/types.ts)

### 2.1 基本型別

- `PluginType = "skill" | "system"`
- `OnlineMethod = "local" | "remote"`
- `StateCode = 0 | 1 | -1 | -2 | -3`

### 2.2 Manifest

- `runtime.startupWeight`（必填）
- `runtime.method`
- `runtime.onlineOptions.oneOf`
- `dependencies.skill/system`（值為精確版本字串）

### 2.3 Lifecycle（throw-only）

`IPlugin` / `IStrategy` 契約：

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<{ status: StateCode }>`
- `send(options): Promise<unknown>`

失敗時不回傳 `{ ok:false }`，直接 throw。

## 3. 驗證工具

檔案：[`src/core/plugin-sdk/manifest.ts`](../../src/core/plugin-sdk/manifest.ts)

- `validateManifest(manifest): void`
- `validateOnlineOptions(manifest, options): void`
- `getSchemaForMethod(manifest, method)`

驗證失敗會 throw `PluginSdkError`。

## 4. 錯誤

檔案：[`src/core/plugin-sdk/errors.ts`](../../src/core/plugin-sdk/errors.ts)

- `CoreErrorCode`
- `PluginSdkError`
- `makeError`（保留給需要結構化錯誤物件的場景）

## 5. 與 PluginsManager 的邊界

- SDK 定義插件契約與驗證邏輯。
- manager 負責掃描、依賴排序、上線排程、錯誤回收。

參考：[`docs/pluginsManager/overview.md`](../pluginsManager/overview.md)
