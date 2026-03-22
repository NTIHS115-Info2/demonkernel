# Demonkernel Plugins Overview

本文件描述 Demonkernel 目前插件系統（skill + system）與新版 PluginsManager 的關係。

## 1. 目錄

```text
src/
  core/
    plugin-sdk/
    pluginsManager/
  skillPlugins/
    example/
  systemPlugins/
    example/
```

## 2. 插件基本規格

每個插件目錄至少包含：

- `plugin.manifest.json`
- `index.ts`（編譯後入口通常為 `index.js`）

manifest 重點：

- `meta.name/version/type/entry`
- `runtime.startupWeight`
- `runtime.method`
- `runtime.onlineOptions.oneOf`
- `dependencies.skill/system`（精確版本）

## 3. 新版 PluginsManager

檔案：[`src/core/pluginsManager/index.ts`](../../src/core/pluginsManager/index.ts)

核心能力：

1. 掃描 `dist/skillPlugins`、`dist/systemPlugins`。
2. 驗證 manifest 與 entry。
3. 以 `type:name` 建立唯一鍵。
4. 依賴感知的非同步波次上線。
5. 生命週期錯誤由 manager 統一回收。

## 4. 啟動與關機

啟動入口：[`src/index.ts`](../../src/index.ts)

流程：

1. `discoverPlugins()`
2. `validateDependencies()`
3. `onlineAll()` 或 `online(--plugin)`
4. 收到 SIGINT/SIGTERM 時 `offlineAll()`

## 5. Throw-only 契約

插件 lifecycle（`online/offline/restart/send`）失敗時直接 throw，
manager 端負責捕捉並更新 runtime 狀態。

system capability 提供方式：

- 宣告 `capabilities.provides` 的 system 插件，需實作 `getCapabilityBindings()`。
- registry 解析後拿到的是 capability 專屬 provider methods（非 `send + action` 分流）。

## 6. Observability / Logger

插件策略層建議直接使用 `@core/logger`：

1. 使用穩定 logger 名稱（例如 `plugin-example-skill-local`）。
2. 將 `plugin/type/strategy` 放在 bindings，避免訊息文字重複。
3. 以 `meta` 承載輸入參數與結果摘要。

參考文件：[`docs/logger/integration-tools-plugins-manager.md`](../logger/integration-tools-plugins-manager.md)

## 7. 延伸閱讀

- Plugin SDK：[`docs/plugins/plugin-sdk.md`](./plugin-sdk.md)
- Example Skill：[`docs/plugins/example-skill.md`](./example-skill.md)
- PluginsManager 使用導覽：[`docs/pluginsManager/overview.md`](../pluginsManager/overview.md)
- Logger 概覽：[`docs/logger/overview.md`](../logger/overview.md)
