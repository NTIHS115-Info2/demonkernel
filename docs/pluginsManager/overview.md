<!-- 註解：PluginsManager 使用導覽與操作流程摘要。 -->
# PluginsManager Overview

本文件提供新版 PluginsManager 的使用導覽。

## 1. 功能

- 同時管理 `skillPlugins` 與 `systemPlugins`。
- 掃描並驗證 `plugin.manifest.json`。
- 非同步上線：依賴感知、同波並行。
- 管理器統一處理 lifecycle throw。

## 2. 啟動前提

- 插件需在 `dist/skillPlugins` 或 `dist/systemPlugins`。
- manifest 必須使用 `runtime.startupWeight`（不接受 `priority`）。
- 依賴版本使用精確比對。

## 3. 典型流程

```ts
import pluginsManager from "@core/pluginsManager";

const summary = pluginsManager.discoverPlugins();
if (summary.registered === 0) {
  throw new Error("no plugins discovered");
}

const report = await pluginsManager.onlineAll({
  defaultOnlineOptions: { method: "local" },
});
```

## 4. 回報與觀測

- `getRegistrySnapshot()`：已註冊插件快照。
- `getInvalidPlugins()`：無效插件與原因。
- `getRuntimeStatus()`：執行期狀態（online/error/blocked）。
- `getStartupReport()`：最近一次上線結果。

## 5. 關機

```ts
await pluginsManager.offlineAll();
```

即使某些插件 offline 失敗，manager 仍會繼續處理其他插件。

## 6. ManagerLogger 注入與預設行為

`PluginsManagerOptions.logger` 維持既有型別：

- `info(...args)`
- `warn(...args)`
- `error(...args)`
- `debug?(...args)`

若不注入，`pluginsManager` 會使用 `@core/logger` 的預設 logger。

```ts
import { createKernelLogger } from "@core/logger";
import { PluginsManager } from "@core/pluginsManager";

const manager = new PluginsManager({
  logger: createKernelLogger("plugins-manager").child({ subsystem: "manager" }),
});
```

更多整合方式：[`docs/logger/integration-tools-plugins-manager.md`](../logger/integration-tools-plugins-manager.md)

## 7. 相關文件

- 核心技術文件：[`src/core/pluginsManager/README.md`](../../src/core/pluginsManager/README.md)
- 遷移說明：[`docs/pluginsManager/migration.md`](./migration.md)
- Logger 概覽：[`docs/logger/overview.md`](../logger/overview.md)
