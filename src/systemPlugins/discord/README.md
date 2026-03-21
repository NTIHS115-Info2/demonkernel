# systemPlugins/discord

`discord` 是針對 Demonkernel 新架構的 Discord system plugin，提供三類 I/O 能力：

- 輸入：Discord inbound 訊息流 (`conversation.stream`)
- 輸出：Discord 訊息發送 (`message.send`)
- 控制：Discord typing session (`typing.start` / `typing.stop`)

## 1. 遷移範圍

- 保留：群組 mention / 回覆 bot / owner DM 的輸入路由
- 保留：指定頻道發送訊息
- 新增：typing session 能力，支援 reference count 與持續 `sendTyping()` 心跳
- 移除：`func` 介面、多功能命令分派、舊內部對話實作
- 新契約：`send()` 採 action-only 路由

## 2. 目錄結構

```text
discord/
  README.md
  plugin.manifest.json
  index.ts
  strategies/
    index.ts
    local/
      index.ts
      types.ts
      typingSessionManager.ts
```

## 3. Online Options（local）

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

## 4. Send Contract（Action-Only）

### 4.1 `action = "conversation.stream"` / `system.discord.conversation.stream`

回傳：`EventEmitter`

事件：

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

### 4.2 `action = "message.send"` / `system.discord.message.send`

輸入：

- `message`（必填）
- `channelId`（選填；若未提供則使用 online/default channelId）

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "messageId": "string | null"
}
```

### 4.3 `action = "typing.start"` / `system.discord.typing.start`

輸入：

- `channelId`（選填；若未提供則使用 online/default channelId）

行為：

- 對指定 channel 建立 typing session（reference count +1）
- session 存活期間每 `typingIntervalMs` 續發 `sendTyping()`

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "active": true,
  "refCount": 1
}
```

### 4.4 `action = "typing.stop"` / `system.discord.typing.stop`

輸入：

- `channelId`（選填；若未提供則使用 online/default channelId）

行為：

- typing session reference count -1
- 當 refCount 歸零時停止該 channel typing session

回傳：

```json
{
  "ok": true,
  "channelId": "string",
  "active": false,
  "refCount": 0
}
```

## 5. 訊息過濾規則

1. 群組訊息只處理：
- mention bot
- reply bot

2. 私訊（DM）只處理：
- owner DM -> 輸出到 `conversation.stream`
- 非 owner DM -> 回覆固定文字，不進 stream

3. 頻道過濾：
- `channelId=global`（或未設定）代表全域
- 指定 `channelId` 時僅過濾群組訊息，DM 仍依 owner 規則判斷

## 6. Typing Session 規則

1. session key 以 `channelId` 為準。
2. `typing.start` 採 reference count（+1）。
3. `typing.stop` 採 reference count（-1），歸零才停止。
4. `offline()` 時會清理所有 session，避免殘留 timer。

## 7. Lifecycle 契約

遵循 throw-only lifecycle：

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<{ status: StateCode }>`
- `send(options): Promise<unknown>`

失敗時直接 throw，由 PluginsManager 統一回收。

## 8. 測試覆蓋

對應測試檔：

- `tests/systemPlugins/discord.test.ts`
- `tests/pluginsManager/discord.integration.test.ts`

覆蓋內容：

- lifecycle（online/offline/restart/state）
- secrets 缺值錯誤
- inbound mention/reply/owner DM
- 非 owner DM 固定回覆
- channel filter
- `message.send` 成功與失敗
- `typing.start/typing.stop` reference count 與清理
- capability discover/registry integration
