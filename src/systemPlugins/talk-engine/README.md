# systemPlugins/talk-engine

`talk-engine` 是對話編排核心 plugin，依賴 `llm-remote-gateway`、`discord`、`conversation-history` 三個 capability providers，並內建 local 策略的 Prompt Composer。

提供兩個 capability provider：

- `system.talk.engine.nostream` -> `generateReply(input)`
- `system.talk.engine.stream` -> `streamReply(input)`

## 1. 版本與依賴

- plugin version: `0.5.0`
- capability schema version: `2.1.0`
- 依賴版本：
  - `system:llm-remote-gateway@1.2.0`
  - `system:discord@0.3.0`
  - `system:conversation-history@1.0.1`

## 2. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `relayEnabled` | `boolean` | No | 是否啟用 Discord relay（預設 `true`） |
| `relayErrorReply` | `string` | No | relay 失敗時固定回覆文案 |

## 3. Prompt 與 History 邊界

- Prompt Composer 職責：把 `recent history + current user message` 組成 LLM messages 陣列。
- `talk-engine` 只消費 history provider，不直接管理儲存檔案。
- 當輸入缺少 `conversationId` 與 `userId` 時，會維持舊相容路徑（不套用歷史）。
- v1 非目標：
  - rolling summary
  - facts extraction
  - episodic memory
  - vector retrieval

## 4. Capability Provider Contract

### 4.1 `generateReply({ message, talker?, conversationId?, userId?, historyLimit?, ... })`

- 流程：
  1. 讀取 recent history（若有 scope）。
  2. 寫入當前 user 訊息到 history。
  3. 呼叫 LLM provider `streamChat()` 並聚合 chunk。
  4. 成功時寫入 assistant 回覆到 history。

- 回傳：

```json
{
  "reply": "string"
}
```

### 4.2 `streamReply({ message, talker?, conversationId?, userId?, historyLimit?, ... })`

- 先讀 recent history 並寫入當前 user 訊息。
- 回傳「包裝後」stream emitter（透傳 data/end/error/abort）。
- 內部會追蹤 reasoning lifecycle（首包/累積長度/片段）作診斷，但對外只輸出可見 content。
- 只有在 `end` 事件時才寫入 assistant 歷史；`error/abort` 不寫入 assistant。

## 5. Relay 流程（`relayEnabled=true`）

1. 透過 Discord provider `openConversationStream()` 訂閱 inbound 事件。
2. 事件進 FIFO queue。
3. 每筆先呼叫 `startTyping()`。
4. 用 `generateReply()` 產生回覆，scope 映射：
   - `conversationId = channelId`
   - `userId = author.id`
5. 呼叫 `sendMessage()` 回到原 channel。
6. 最後呼叫 `stopTyping()`。

若 LLM 失敗，會送出 `relayErrorReply`，且 fallback 內容也會寫入 history。

## 6. `send()` 相容入口

`send(options)` 仍保留 plugin-level 呼叫（`talk.nostream` / `talk.stream`）；registry 對外正式契約仍是 `generateReply/streamReply`。
