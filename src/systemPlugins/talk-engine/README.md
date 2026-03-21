# systemPlugins/talk-engine

`talk-engine` 是對話核心 system plugin，負責編排其他 system plugin 能力，提供：

- 通用對話能力：`talk.nostream` / `talk.stream`
- 可選 Discord relay（預設啟用）：自動接 Discord inbound -> LLM -> Discord outbound

## 1. 目錄結構

```text
talk-engine/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/
      index.ts
      constants.ts
      types.ts
      input.ts
      streamCollector.ts
      relayQueue.ts
```

## 2. 依賴

manifest 依賴（精確版本）：

- `system:llm-remote-gateway@1.0.0`
- `system:discord@0.2.0`

## 3. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `relayEnabled` | `boolean` | No | 是否自動啟用 Discord relay，預設 `true` |
| `relayErrorReply` | `string` | No | relay 失敗時固定回覆文案，預設 `目前無法回覆，請稍後再試。` |

## 4. Send Contract（Action-Only）

### 4.1 `action = "talk.nostream"` / `system.talk.engine.nostream`

輸入：

- `message`（必填）
- `talker`（選填）
- `model` / `params` / `tools` / `tool_choice`（選填 passthrough）

行為：

1. 轉換輸入為 llm gateway `chat.stream` payload。
2. 聚合 stream chunk。
3. 回傳完整結果。

輸出：

```json
{
  "reply": "string"
}
```

### 4.2 `action = "talk.stream"` / `system.talk.engine.stream`

輸入：與 `talk.nostream` 相同。

輸出：llm gateway EventEmitter（透傳，不包裝）

- `data(content, raw, reasoning)`
- `end()`
- `error(error)`
- `abort()`

## 5. Discord Relay（預設啟用）

`online()` 後若 `relayEnabled=true`，流程如下：

1. 訂閱 `system.discord.conversation.stream`
2. 每筆事件進入內部 FIFO queue
3. 每筆處理前呼叫 `system.discord.typing.start`
4. 以 `talk.nostream` 生成 reply
5. 呼叫 `system.discord.message.send` 回覆到原 `channelId`
6. 失敗時改回固定錯誤文案
7. 結束時呼叫 `system.discord.typing.stop`

## 6. 輸入轉換規則

- 單輪無歷史。
- 若有 `talker`，user content 會轉為：`<sender={talker}>: {message}`。
- 若無 `talker`，直接使用 `message`。

## 7. Lifecycle 契約

遵循 throw-only lifecycle：

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<{ status: StateCode }>`
- `send(options): Promise<unknown>`

## 8. 測試覆蓋

對應測試檔：

- `tests/systemPlugins/talk-engine.test.ts`
- `tests/pluginsManager/talk-engine.integration.test.ts`

覆蓋內容：

- lifecycle
- `talk.nostream` 聚合回覆
- `talk.stream` emitter 透傳
- payload 轉換
- relay 自動流程與 FIFO
- relay 錯誤回覆
- capability discover/registry integration

