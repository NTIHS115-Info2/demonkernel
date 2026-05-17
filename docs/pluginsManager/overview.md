<!-- 註解：PluginsManager 使用導覽與操作流程摘要。 -->
# PluginsManager Overview

本文件提供新版 PluginsManager 的使用導覽。

## 1. 功能

- 同時管理 `skillPlugins` 與 `systemPlugins`。
- 掃描並驗證 `plugin.manifest.json`。
- 非同步上線：依賴感知、同波並行。
- 循環依賴（SCC）支援：依 `startupWeight` 分波啟動。
- 管理器統一處理 lifecycle throw。
- 管理 capability provider 綁定（`getCapabilityBindings()` -> registry）。

## 2. 啟動前提

- 插件需在 `dist/skillPlugins` 或 `dist/systemPlugins`。
- manifest 必須使用 `runtime.startupWeight`（不接受 `priority`）。
- 依賴版本使用精確比對。

## 3. 依賴排程規則

- 依賴已 online 且版本相符：可啟動。
- 依賴不在啟動佇列且未 online：失敗。
- 依賴啟動失敗：依賴方失敗。
- 循環依賴（SCC）：高 `startupWeight` 先啟動；同權重同波並行。
- `blocked` 僅表示當前無法推進（deadlock），不是一般循環依賴的預設結果。

## 4. 典型流程

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

## 5. 回報與觀測

- `getRegistrySnapshot()`：已註冊插件快照。
- `getInvalidPlugins()`：無效插件與原因。
- `getRuntimeStatus()`：執行期狀態（online/error/blocked）。
- `getStartupReport()`：最近一次上線結果。

capability 行為：

- system 插件若宣告 `capabilities.provides`，online 後必須提供對應 binding。
- registry 只暴露 capability-bound provider methods（非 `provider.send(action)`）。

## 6. 關機

```ts
await pluginsManager.offlineAll();
```

即使某些插件 offline 失敗，manager 仍會繼續處理其他插件。

## 7. ManagerLogger 注入與預設行為

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

## 8. 相關文件

- 核心技術文件：[`src/core/pluginsManager/README.md`](../../src/core/pluginsManager/README.md)
- 遷移說明：[`docs/pluginsManager/migration.md`](./migration.md)
- Manifest 結構：[`docs/pluginsManager/plugin-manifest-schema.md`](./plugin-manifest-schema.md)
- Logger 概覽：[`docs/logger/overview.md`](../logger/overview.md)
