# systemPlugins/discord

`discord` 是針對 Demonkernel 新架構的 Discord system plugin，僅遷移舊插件的 I/O 能力：

- 輸入：Discord inbound 訊息流 (`conversation.stream`)
- 輸出：Discord outbound 發送 (`message.send`)

不包含舊版 slash command、TalkToDemon、句子分段回覆等能力。

## 1. 遷移範圍

- 保留：群組 mention / 回覆 bot / owner DM 的輸入路由
- 保留：指定頻道發送訊息
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
```

## 3. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `channelId` | `string` | No | 監聽群組頻道；`global`/空值代表全域 |
| `ownerUserId` | `string` | No | owner 使用者 ID，優先於 secret |
| `nonOwnerDmReply` | `string` | No | 非 owner DM 固定回覆文案 |

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

## 6. Lifecycle 契約

遵循 throw-only lifecycle：

- `online(options): Promise<void>`
- `offline(): Promise<void>`
- `restart(options): Promise<void>`
- `state(): Promise<{ status: StateCode }>`
- `send(options): Promise<unknown>`

失敗時直接 throw，由 PluginsManager 統一回收。

## 7. 測試覆蓋

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
- capability discover/registry integration
