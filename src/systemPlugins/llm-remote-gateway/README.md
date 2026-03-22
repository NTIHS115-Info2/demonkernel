# systemPlugins/llm-remote-gateway

`llm-remote-gateway` 是 remote-only system plugin，提供 OpenAI 相容 API 的三個 capability provider：

- `system.llm.remote.chat.stream` -> `streamChat(input)`
- `system.llm.remote.models.list` -> `listModels(input?)`
- `system.llm.remote.health.check` -> `checkHealth(input?)`

## 1. 版本與能力契約

- plugin version: `1.1.0`
- capability schema version: `2.0.0`（provider-first，移除 capability action alias 契約）

## 2. Online Options（remote）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"remote"` | Yes | strategy 固定 remote |
| `baseUrl` | `string` | Yes | OpenAI 相容服務網址 |
| `model` | `string` | No | 預設模型 |
| `timeoutMs` | `number` | No | 請求 timeout（預設 `30000`） |
| `connectionTimeoutMs` | `number` | No | 串流首包 timeout（預設 `10000`） |
| `maxRetries` | `number` | No | chat 請求最大重試次數（預設 `3`） |
| `retryDelayBaseMs` | `number` | No | 重試基礎延遲（預設 `1000`） |
| `reqId` | `string` | No | 預設 request id |
| `reqIdHeader` | `string` | No | request id header（預設 `X-Request-Id`） |
| `headers` | `object` | No | 追加 header |

## 3. Capability Provider Contract

### 3.1 `streamChat(input)`

- endpoint: `/v1/chat/completions`
- 回傳：`EventEmitter`
- 事件：
  - `data(content, normalizedChunk, reasoningContent)`
  - `end()`
  - `error(error)`
  - `abort()`
- 可透過 `emitter.abort()` 主動中止。

### 3.2 `listModels(input?)`

- endpoint: `/v1/models`
- 回傳 JSON：`ok/status/models/raw/message?/errorType?`

### 3.3 `checkHealth(input?)`

- endpoint: `/v1/models`（以 models 可用性作健康檢查）
- 回傳 JSON：`ok/status/message/errorType?/raw?`

## 4. `send()` 相容入口

`send(options)` 仍保留於 plugin-level，支援既有 action/legacy 呼叫；但 capability registry 不再依賴 `send + action` 做能力邊界路由。

## 5. 錯誤與重試

- 錯誤分類：`request_error` / `server_error` / `timeout` / `parse_error`
- `streamChat` 支援 retry + exponential backoff
- `listModels`/`checkHealth` 回傳 `ok=false` 結果物件
