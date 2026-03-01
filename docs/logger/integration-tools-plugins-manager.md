# Logger Integration（tools / plugins / pluginsManager）

本文件說明如何在不同層級接入新版 logger。

## 適用範圍

- 適用：`src/index.ts`、`src/core/pluginsManager`、plugin strategy。
- 不在範圍：`tools/updatelog` 互動提示輸出（仍建議保留 `console.*`）。

## 對應程式路徑

- [`src/index.ts`](../../src/index.ts)
- [`src/core/pluginsManager/index.ts`](../../src/core/pluginsManager/index.ts)
- [`src/core/pluginsManager/types.ts`](../../src/core/pluginsManager/types.ts)
- [`src/skillPlugins/example/strategies/local/index.ts`](../../src/skillPlugins/example/strategies/local/index.ts)
- [`src/systemPlugins/example/strategies/local/index.ts`](../../src/systemPlugins/example/strategies/local/index.ts)

## 命名與 bindings 建議

1. logger name 使用穩定、可搜尋的模組名，例如：`plugins-manager`、`kernel-startup`。
2. child/bindings 放追蹤欄位：`traceId`、`plugin`、`strategy`、`component`。
3. `message` 保持簡潔，詳細內容放 `meta`。

## 最小可用範例：`src/index.ts` 啟動流程

```ts
import { createKernelLogger, shutdownKernelLogger } from "@core/logger";

const startupLogger = createKernelLogger("kernel-startup", { component: "entrypoint" });

startupLogger.info("startup begin");
startupLogger.warn("dependency validation warning", { plugin: "skill:example" });

await shutdownKernelLogger();
```

## 最小可用範例：`pluginsManager` logger 注入

`PluginsManagerOptions.logger` 維持既有 `ManagerLogger` 型別，不需改 interface。

```ts
import { createKernelLogger } from "@core/logger";
import { PluginsManager } from "@core/pluginsManager";

const manager = new PluginsManager({
  logger: createKernelLogger("plugins-manager").child({ subsystem: "manager" }),
});
```

## 最小可用範例：plugin strategy 建立 logger

```ts
import { createKernelLogger } from "@core/logger";

const logger = createKernelLogger("plugin-example-skill-local", {
  plugin: "example",
  type: "skill",
  strategy: "local",
});

logger.info("strategy online", { method: "local" });
```

## tools 邊界說明

1. 非互動 background worker / daemon 類工具：建議接入新版 logger。
2. 互動 CLI（例如問答、選單）：
   - 使用者回饋仍以 `console.*` 為主。
   - 若要記錄審計資訊，可平行寫 logger，但不要取代互動輸出。

