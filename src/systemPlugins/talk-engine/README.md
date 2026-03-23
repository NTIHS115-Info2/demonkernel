# systemPlugins/talk-engine

`talk-engine` 是對話編排核心 plugin，依賴 `llm-remote-gateway` 與 `discord` 的 capability providers，並內建 local 策略的 Prompt Composer。

提供兩個 capability provider：

- `system.talk.engine.nostream` -> `generateReply(input)`
- `system.talk.engine.stream` -> `streamReply(input)`

## 1. 版本與依賴

- plugin version: `0.3.0`
- capability schema version: `2.0.0`
- 依賴版本：
  - `system:llm-remote-gateway@1.1.0`
  - `system:discord@0.3.0`

## 2. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `relayEnabled` | `boolean` | No | 是否啟用 Discord relay（預設 `true`） |
| `relayErrorReply` | `string` | No | relay 失敗時固定回覆文案 |

## 3. 內建 Prompt Composer（local）

- 職責：將已正規化輸入組合為送往 LLM 的 prompt 訊息陣列。
- 本版只做基礎組合，不處理歷史訊息、工具結果緩衝、系統提示詞注入。
- 輸出固定為單一 user message：
  - 有 `talker`：`[{ role: "user", content: "<sender={talker}>: {message}" }]`
  - 無 `talker`：`[{ role: "user", content: "{message}" }]`

## 4. Capability Provider Contract

### 4.1 `generateReply({ message, talker?, model?, tools?, tool_choice?, params? ... })`

- 內部呼叫 LLM provider `streamChat()`，聚合 stream chunk 後回傳：

```json
{
  "reply": "string"
}
```

### 4.2 `streamReply({ message, talker?, model?, tools?, tool_choice?, params? ... })`

- 直接回傳 LLM provider 的 stream emitter（不包裝）。

## 5. Relay 流程（`relayEnabled=true`）

1. 透過 Discord provider `openConversationStream()` 訂閱 inbound 事件。
2. 事件進 FIFO queue。
3. 每筆先呼叫 `startTyping()`。
4. 用 `generateReply()` 產生回覆。
5. 呼叫 `sendMessage()` 回到原 channel。
6. 最後呼叫 `stopTyping()`。

## 6. `send()` 相容入口

`send(options)` 仍保留 plugin-level 呼叫（`talk.nostream` / `talk.stream`）；但 capability registry 對外正式契約為 `generateReply/streamReply`。
