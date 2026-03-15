# systemPlugins/llm-remote-gateway

`llm-remote-gateway` 是從舊 `llamaServer` 遷移出的 **remote-only** system plugin，專注於 OpenAI 相容 API 的外部呼叫。

## 1. 遷移範圍 / Migration Scope

- 只遷移 `remote` 能力，不包含 `local` 與 `server`。
- lifecycle 遵循新插件 throw-only 契約：`online/offline/restart/state/send`。
- 所有參數來源為 `online/send options`，不讀 env/config。

## 2. 目錄結構

```text
llm-remote-gateway/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    remote/
      index.ts
      constants.ts
      errors.ts
      messageValidator.ts
      payload.ts
      sse.ts
      types.ts
```

## 3. Online Options（remote）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"remote"` | Yes | strategy 固定 remote |
| `baseUrl` | `string` | Yes | OpenAI 相容服務網址，例如 `http://localhost:8000` |
| `model` | `string` | No | 預設模型 |
| `timeoutMs` | `number` | No | 請求 timeout，預設 `30000` |
| `connectionTimeoutMs` | `number` | No | 串流首包 timeout，預設 `10000` |
| `maxRetries` | `number` | No | chat 請求最大重試次數，預設 `3` |
| `retryDelayBaseMs` | `number` | No | 重試基礎延遲，預設 `1000` |
| `reqId` | `string` | No | 預設 request id |
| `reqIdHeader` | `string` | No | 預設 request id header，預設 `X-Request-Id` |
| `headers` | `object` | No | 追加 header |

## 4. Send Contract（Capability-Oriented）

### 4.1 `action = "chat.stream"` / `system.llm.remote.chat.stream`

- Endpoint: `/v1/chat/completions`
- 回傳：`EventEmitter`
- 事件：
  - `data(content, normalizedChunk, reasoningContent)`
  - `end()`
  - `error(error)`
  - `abort()`
- 中止：`emitter.abort()`

相容舊行為：

- `send(messagesArray)` 自動視為 `chat.stream`
- `send({ messages: [...] })` 自動視為 `chat.stream`

### 4.2 `action = "models.list"` / `system.llm.remote.models.list`

- Endpoint: `/v1/models`
- 回傳 JSON：
  - `ok: boolean`
  - `status: number`
  - `models: unknown[]`
  - `raw: unknown`
  - `message?: string`
  - `errorType?: string`

### 4.3 `action = "health.check"` / `system.llm.remote.health.check`

- Endpoint: `/v1/models`（以 models 健康檢查）
- 回傳 JSON：
  - `ok: boolean`
  - `status: number`
  - `message: string`
  - `errorType?: string`
  - `raw?: unknown`

## 5. 錯誤與重試策略

- 錯誤分類：`request_error` / `server_error` / `timeout` / `parse_error`
- `chat.stream` 請求階段支援 exponential backoff 重試
- `models.list` 與 `health.check` 回傳 `ok=false` 結果而非串流 error event

## 6. 訊息清理規則（Message Sanitization）

- 驗證合法 role：`system | user | assistant | tool`
- 移除禁止欄位：`reasoning_content`, `timestamp`, `talker`
- 支援 `assistant + tool_calls` 的 `content = null` 規則
- 支援 `tool` 訊息的 `name/tool_call_id` 清理

## 7. 測試案例對照

| 測試類型 | 覆蓋內容 |
| --- | --- |
| 插件單元 | lifecycle、action 路由、stream data/reasoning、abort |
| 錯誤路徑 | timeout、retry、最終錯誤分類 |
| models/health | 成功與失敗回傳結構 |
| validator/payload | 訊息清理、payload 驗證、forbidden fields |
| manager/capability | discover 註冊能力、online 後 registry 可 resolve 並呼叫 |
