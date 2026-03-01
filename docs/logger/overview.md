# Logger Overview

本文件說明 Demonkernel 新版 logger 的定位、目錄策略與核心行為。

## 適用範圍

- 適用：`src` 執行流程、`pluginsManager`、example plugins、其他 Node.js 腳本。
- 不在範圍：`tools/updatelog` 的互動式 CLI 輸出流程（目前維持 `console.*`）。

## 對應程式路徑

- [`tools/logger/index.js`](../../tools/logger/index.js)
- [`tools/logger/lib/`](../../tools/logger/lib)
- [`src/core/logger/index.ts`](../../src/core/logger/index.ts)

## 設計目標

1. 對標 winston/pino 核心能力：level gate、child logger、結構化 JSON、多 transport。
2. 每次啟動建立獨立 session 目錄，避免歷史檔案互相覆寫。
3. 每個 logger 同時輸出 `.log`（人讀）與 `.json`（JSON Lines）。
4. 舊 session 目錄背景非同步壓縮成 `.tar.gz`，不阻塞主流程。
5. 敏感資訊遮罩同時作用在文字與 JSON 輸出。

## 輸出目錄與檔案規則

- 根目錄：`logs/`
- session 目錄：`<ISO datetime>-<pid>`
- 檔案分流：
  - `logs/<session>/log/<logger-name>.log`
  - `logs/<session>/json/<logger-name>.json`
- `.json` 格式：每行一筆 JSON 物件（JSON Lines）

## 預設行為

- logger level：`info`
- console transport：僅輸出 `warn/error/fatal`
- redaction：啟用（可透過 `configureLogger` 關閉）
- 壓縮清理：只壓縮舊目錄，不自動刪除歷史 `.tar.gz`

## 最小可用範例

```ts
import { createKernelLogger, shutdownKernelLogger } from "@core/logger";

const logger = createKernelLogger("kernel-startup", { module: "entry" });

logger.info("startup begin");
logger.warn("dependency warning", { dependency: "skill:example" });

await shutdownKernelLogger();
```

## 與舊版差異摘要

1. 舊版 `new Logger("name")` 改為 `createKernelLogger("name")`。
2. 新版在同一個 session 下改為 `log/` 與 `json/` 分目錄儲存雙檔。
3. 舊版同步壓縮改為背景非同步壓縮。
4. 舊版 `Original/logRaw` 介面已移除，改用結構化 `meta` 欄位。

## 延伸閱讀

- [`docs/logger/api-reference.md`](./api-reference.md)
- [`docs/logger/integration-tools-plugins-manager.md`](./integration-tools-plugins-manager.md)
- [`docs/logger/migration-from-legacy.md`](./migration-from-legacy.md)
- [`docs/logger/operations.md`](./operations.md)
