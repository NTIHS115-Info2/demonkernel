# Logger API Reference

本文件定義 Demonkernel 新 logger API 與資料結構。

## 適用範圍

- 適用：在 `src` 與 `tools` 寫入結構化日誌。
- 不在範圍：舊版 `Demon/src/utils/logger.js` 介面（請看 migration 文件）。

## 對應程式路徑

- [`tools/logger/index.js`](../../tools/logger/index.js)
- [`tools/logger/lib/levels.js`](../../tools/logger/lib/levels.js)
- [`tools/logger/lib/serializer.js`](../../tools/logger/lib/serializer.js)
- [`src/core/logger/index.ts`](../../src/core/logger/index.ts)

## Root API（CommonJS）

### `configureLogger(options?)`

設定全域 logger 行為。

`options`：

- `rootDir?: string`
- `level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal"`
- `redact?: boolean`
- `redactionPatterns?: RegExp[]`
- `console?: { enabled?: boolean; level?: LogLevel; levels?: LogLevel[] }`

### `getLogger(name, bindings?)`

取得 logger instance。

- `name: string`：會被 sanitize 後用於檔名。
- `bindings?: Record<string, unknown>`：每筆 log 都會附帶。

### `flushLogs()`

等待目前所有寫入 queue 與背景壓縮工作完成。

### `shutdownLogger()`

執行 flush 並關閉所有 stream；建議在程序結束前呼叫。

### `getCurrentLogSessionPath()`

回傳目前 session 目錄絕對路徑（該目錄下固定包含 `log/` 與 `json/`）。

## Logger Instance API

- `trace(message, meta?)`
- `debug(message, meta?)`
- `info(message, meta?)`
- `warn(message, meta?)`
- `error(message, meta?)`
- `fatal(message, meta?)`
- `child(bindings)`
- `isLevelEnabled(level)`

## TypeScript Wrapper API

由 [`src/core/logger/index.ts`](../../src/core/logger/index.ts) 提供：

- `configureKernelLogger(options?)`
- `createKernelLogger(name, bindings?)`
- `flushKernelLogs()`
- `shutdownKernelLogger()`

## JSON Lines 欄位

每行一筆 JSON，欄位如下：

- `timestamp: string` (ISO)
- `level: string`
- `logger: string`
- `message: string`
- `bindings: object`
- `meta?: object`
- `pid: number`
- `hostname: string`
- `err?: { name, message, stack, code?, cause? }`

## 最小可用範例

```ts
import { createKernelLogger } from "@core/logger";

const logger = createKernelLogger("plugins-manager", { subsystem: "runtime" });

if (logger.isLevelEnabled("debug")) {
  logger.debug("dependency graph loaded");
}

logger.error("plugin online failed", {
  key: "skill:example",
  reason: "dependency missing",
});
```
