# Logger Operations Guide

本文件提供新版 logger 的維運操作與故障排查指南。

## 適用範圍

- 適用：部署、排查、效能調整、關機收斂。
- 不在範圍：業務事件語義定義（請由各模組自行定義 message/meta）。

## 對應程式路徑

- [`tools/logger/index.js`](../../tools/logger/index.js)
- [`tools/logger/lib/compress.js`](../../tools/logger/lib/compress.js)
- [`tools/logger/lib/transports.js`](../../tools/logger/lib/transports.js)

## 日誌目錄維運

1. 根目錄固定 `logs/`。
2. 每次啟動建立新 session 子目錄。
3. session 目錄固定分流為：
   - `logs/<session>/log/<name>.log`
   - `logs/<session>/json/<name>.json`
4. 舊 session 會嘗試壓縮為 `<session>.tar.gz`。

## 壓縮降級策略

壓縮流程失敗時採「不阻塞主流程」策略：

1. 壓縮錯誤僅輸出到 `stderr`（前綴 `[logger]`）。
2. 當前程序的 log 寫入持續進行。
3. 未壓縮的舊 session 會保留在 `logs/`，可下次再重試。

## 關機規範

程序即將退出時，必須呼叫：

```ts
import { shutdownKernelLogger } from "@core/logger";

await shutdownKernelLogger();
```

目的：

1. 等待寫入 queue flush。
2. 關閉所有 write stream。
3. 等待背景壓縮任務完成。

## 故障排查

### 1. 沒有產生 log 檔

檢查項目：

1. 是否已呼叫 `createKernelLogger`。
2. `level` 是否過高導致訊息被 gate 掉。
3. 程序是否在 `shutdownKernelLogger` 前就被強制結束。

### 2. 壓縮檔沒出現

檢查項目：

1. `logs/` 下是否有舊 session 目錄可壓縮。
2. 是否有 `[logger]` 壓縮錯誤訊息。
3. 是否已等待 `flush/shutdown`。

### 3. JSON 內容不符合預期

檢查項目：

1. `message` 是否傳入 Error / object。
2. `meta` 是否使用不可序列化物件（新版會降級為可序列化內容）。
3. redaction 是否把關鍵字遮罩（屬預期行為）。

## 效能建議

1. 大型 payload 放 `meta`，避免 message 過長。
2. production 預設維持 `info` 或更高。
3. 大量 debug 追蹤請用短期設定，不建議長期常駐。
4. 壓縮檔永久保留時，請由外部維運機制定期清理。

## 最小可用範例

```ts
import { configureKernelLogger, createKernelLogger, shutdownKernelLogger } from "@core/logger";

configureKernelLogger({
  level: "info",
  console: { enabled: true, levels: ["warn", "error", "fatal"] },
});

const logger = createKernelLogger("ops-demo");
logger.info("service started");

await shutdownKernelLogger();
```
