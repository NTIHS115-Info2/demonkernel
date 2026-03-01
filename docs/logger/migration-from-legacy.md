# Logger Migration From Legacy

本文件提供舊版 `Demon/src/utils/logger.js` 到新版 `tools/logger` 的遷移對照。

## 適用範圍

- 適用：從舊 `new Logger(...)` 風格搬遷到新 API。
- 不在範圍：舊專案 `Demon` 內部所有業務邏輯調整。

## 對應程式路徑

- 舊版參考：`Demon/src/utils/logger.js`
- 新版實作：[`tools/logger/index.js`](../../tools/logger/index.js)
- TS wrapper：[`src/core/logger/index.ts`](../../src/core/logger/index.ts)

## Method 對照表

| Legacy | New | 備註 |
| --- | --- | --- |
| `new Logger("name")` | `createKernelLogger("name")` | 由 class constructor 改為 factory |
| `info(msg)` | `info(message, meta?)` | 可帶結構化 `meta` |
| `warn(msg)` | `warn(message, meta?)` | 同上 |
| `error(msg)` | `error(message, meta?)` | 同上 |
| `debug(msg)` | `debug(message, meta?)` | level gate 預設可能關閉 |
| `getLogPath()` | `getCurrentLogSessionPath()` | 回傳本次 session 路徑 |
| `SetConsoleLog(bool)` | `configureLogger({ console: { enabled } })` | 可進一步設定 levels |
| `filterSensitiveInfo` | `configureLogger({ redact, redactionPatterns })` | 改為全域 redaction 設定 |
| `Original(msg)` | 無直接對應 | 建議改 `info(msg, { raw: true })` |
| `logRaw(level, msg)` | 無直接對應 | 建議使用結構化 `meta` |
| `safeStringify(obj)` | 無直接對應 | 新版內建安全序列化 |

## 破壞性變更

1. 不再保留舊 class API 與 `Original/logRaw`。
2. 輸出由單一 `.log` 改為 `session/log` 與 `session/json` 目錄分流的雙檔。
3. 壓縮由同步改為背景非同步。
4. console 預設僅輸出 `warn/error/fatal`。

## 最小可用範例（常見替換）

### 舊版

```js
const Logger = require("../utils/logger");
const logger = new Logger("ttsEngine.log");
logger.info("online");
```

### 新版（TS）

```ts
import { createKernelLogger } from "@core/logger";

const logger = createKernelLogger("tts-engine");
logger.info("online", { strategy: "local" });
```
