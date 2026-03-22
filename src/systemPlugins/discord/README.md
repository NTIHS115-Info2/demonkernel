# systemPlugins/discord

`discord` 是 Demonkernel 的 Discord I/O system plugin，提供四個 capability provider：

- `system.discord.conversation.stream` -> `openConversationStream()`
- `system.discord.message.send` -> `sendMessage(input)`
- `system.discord.typing.start` -> `startTyping(input)`
- `system.discord.typing.stop` -> `stopTyping(input)`

## 1. 版本與能力契約

- plugin version: `0.3.0`
- capability schema version: `2.0.0`（provider-first，移除 capability action alias 契約）

## 2. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `channelId` | `string` | No | 監聽群組頻道；`global`/空值代表全域 |
| `ownerUserId` | `string` | No | owner 使用者 ID，優先於 secret |
| `nonOwnerDmReply` | `string` | No | 非 owner DM 固定回覆文案 |
| `typingIntervalMs` | `number` | No | typing 心跳間隔（毫秒），預設 `9000` |

密鑰來源（統一走 `@core/secrets`）：

- `DISCORD_TOKEN`（必填）
- `DISCORD_USER_ID`（owner 預設）
- `DISCORD_CHANNEL_ID`（channelId 預設）

## 3. Capability Provider Contract

### 3.1 `openConversationStream()`

回傳 `EventEmitter`，事件：

- `data(payload)`
- `error(error)`

`payload` 結構：

```json
{
  "source": "mention | reply | owner_dm",
  "content": "string",
  "rawContent": "string",
  "channelId": "string",
  "guildId": "string | null",
  "messageId": "string",
  "replyToMessageId": "string | null",
  "author": {
    "id": "string",
    "name": "string",
    "isOwner": true
  },
  "receivedAt": "ISO datetime"
}
```

### 3.2 `sendMessage({ channelId?, message })`

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "messageId": "string | null"
}
```

### 3.3 `startTyping({ channelId? })`

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "active": true,
  "refCount": 1
}
```

### 3.4 `stopTyping({ channelId? })`

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "active": false,
  "refCount": 0
}
```

## 4. `send()` 相容入口

`send(options)` 仍保留，供 plugin-level 呼叫使用；但 capability registry 不再依賴 `send + action` 進行能力路由。

## 5. 訊息與 Typing 規則

1. 群組只處理 mention bot / reply bot。
2. DM 只接受 owner，非 owner DM 回固定文案。
3. typing session 以 `channelId` 做 reference count；`offline()` 會清理全部 session。
