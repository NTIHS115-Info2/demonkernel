<!-- 註解：舊版 pluginsManager 遷移到新版架構的對照與步驟。 -->
# PluginsManager Migration Guide

本文件說明舊版 `pluginsManager.js` 到新版 `src/core/pluginsManager` 的主要差異。

## 1. 重大破壞性變更

1. 不再支援 `runtime.priority`，改為 `runtime.startupWeight`。
2. 插件 lifecycle 改為 throw-only；manager 統一捕捉錯誤。
3. 不再提供 LLM 專屬 API（`StartLLMTool`、`SetExceptionLLMTool`）。
4. 不再包含 `expressApp` 注入責任。

## 2. ID 與命名

- 舊版：主要依插件名稱。
- 新版：以 `type:name` 作唯一鍵，例如 `skill:example`、`system:example`。

## 3. 啟動排程

- 舊版：單純 queue 機制。
- 新版：依賴感知波次上線。
  - 同波依 `startupWeight` 高到低排序。
  - 同波並行啟動。

## 4. 依賴行為

新版嚴格規則：

1. 依賴上線且版本相符：允許啟動。
2. 依賴不在線但在佇列中：等待。
3. 依賴不在線且不在佇列：失敗。
4. 依賴啟動失敗：依賴方失敗。
5. 循環依賴：直接 blocked。

## 5. API 對照

- `loadAllPlugins()` -> `discoverPlugins()`
- `queueAllOnline()` -> `onlineAll()`
- `queueOnline(name)` -> `online(ref)`
- `offline(name)` -> `offline(ref)`
- `restartAll()` -> 逐一 `restart(ref)` 或自定流程
- `getInvalidPlugins()` -> 保留（新版同名）

## 6. 建議遷移順序

1. 先改所有 manifest：`priority -> startupWeight`。
2. 把插件 lifecycle 改為 throw-only。
3. 將啟動入口改為新 manager。
4. 補齊依賴版本與 cycle 測試。
