<!-- 註解：PluginsManager 核心技術說明文件（完整版）。 -->
# PluginsManager

`src/core/pluginsManager` 是 Demonkernel 新版插件管理核心，統一管理 `skillPlugins` 與 `systemPlugins`。

## 目標

1. 掃描並驗證插件（manifest + entry + lifecycle 契約）。
2. 非同步上線（依賴感知、波次啟動、同波並行）。
3. 統一生命週期錯誤回收（throw-only 插件契約）。
4. 提供可觀測 API（registry、invalid、runtime、startup report）。

## 目錄

```text
src/core/pluginsManager/
  index.ts
  types.ts
  errors.ts
  registry.ts
  lifecycle.ts
  dependency.ts
```

## 核心概念

- 唯一鍵：`type:name`，例如 `skill:example`。
- 掃描來源：預設 `dist/skillPlugins`、`dist/systemPlugins`。
- 生命週期狀態：`offline | starting | online | stopping | error | blocked`。
- 依賴版本：`dependencies` 需精確版本匹配。

## 啟動流程

1. `discoverPlugins()`：掃描/驗證、建立 registry。
2. `validateDependencies()`：靜態檢查缺依賴與版本不符。
3. `onlineAll()`：
   - 先檢查 cycle。
   - 每波找出依賴已滿足的插件。
   - 同波插件依 `startupWeight` 由高到低排序後並行上線。
   - 若依賴不在佇列且未 online，直接失敗。
   - 若依賴上線失敗，依賴方立即失敗。

## 依賴規則

- 依賴已 online + 版本符合：可啟動。
- 依賴未 online 但在本次佇列：等待。
- 依賴不在佇列且未 online：失敗。
- 依賴失敗：失敗。
- 循環依賴：直接 `blocked`。

## Public API 摘要

- `discoverPlugins(): ScanSummary`
- `validateDependencies(): { ok: boolean; errors: string[] }`
- `onlineAll(options?: StartupOptions): Promise<StartupReport>`
- `online(ref, command?): Promise<LifecycleActionResult>`
- `offline(ref): Promise<LifecycleActionResult>`
- `restart(ref, command?): Promise<LifecycleActionResult>`
- `send(ref, payload): Promise<LifecycleActionResult<unknown>>`
- `state(ref): Promise<StateResult>`
- `offlineAll(): Promise<LifecycleActionResult[]>`
- `getRegistrySnapshot()` / `getInvalidPlugins()` / `getRuntimeStatus()` / `getStartupReport()`

## 錯誤模型

- 插件 lifecycle 發生任何錯誤時，插件直接 throw。
- manager 端捕捉錯誤後更新 runtime：
  - `state = error` 或 `blocked`
  - `lastError = message`

## 使用範例

```ts
import pluginsManager from "@core/pluginsManager";

pluginsManager.discoverPlugins();

const report = await pluginsManager.onlineAll({
  defaultOnlineOptions: { method: "local" },
});

if (report.failed.length > 0 || report.blocked.length > 0) {
  console.error(report);
}
```
