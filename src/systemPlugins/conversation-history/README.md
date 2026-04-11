# systemPlugins/conversation-history

`conversation-history` 是 v1 純上下文（transcript store）插件，負責保存、讀取與清除對話歷史。

本插件只處理歷史訊息，不負責任何記憶強化能力。

## 1. 版本與定位

- plugin version: `1.0.1`
- capability schema version: `1.0.0`
- runtime method: `local`
- 儲存方式：JSON 檔案 + 記憶體 cache

## 2. 責任邊界

`conversation-history` 負責：

- append 歷史訊息
- 讀取最近歷史（含裁剪）
- 清除指定 scope 歷史
- 過期與數量裁剪
- 檔案輪轉備份（依 `maxFileSize` + `backupCount`）

`conversation-history` v1 不負責：

- rolling summary
- facts 抽取
- episodic memory
- 向量檢索
- 長期推理圖譜
- 多模態記憶

## 3. Scope 與儲存策略

- scope 策略：conversation-first
  - 有 `conversationId` 時優先使用
  - 否則使用 `userId`
- 檔案預設目錄：`<project-root>/history`
- 每個 scope 對應一個 JSON 檔（檔名經安全化）
- 訊息格式：
  - `role`: `system | user | assistant | tool`
  - `content`: `string`
  - `timestamp`: `number`（epoch ms）

## 4. Online Options（local）

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `method` | `"local"` | Yes | strategy 固定 local |
| `historyDir` | `string` | No | 歷史檔目錄（預設 `./history`） |
| `maxMessages` | `number` | No | 最大保留訊息數（預設 `100`） |
| `expireDays` | `number` | No | 訊息過期天數（預設 `7`） |
| `backupCount` | `number` | No | 輪轉備份數（預設 `3`） |
| `maxFileSize` | `number` | No | 觸發輪轉的檔案大小 bytes（預設 `1048576`） |

## 5. Capability Provider Contract

- `system.conversation.history.append` -> `appendMessage(input): Promise<void>`
- `system.conversation.history.recent` -> `getRecentMessages(scope, limit?): Promise<HistoryMessage[]>`
- `system.conversation.history.clear` -> `clearConversation(scope): Promise<void>`

其中：

- `appendMessage` 需要 `role`、`content` 與 scope（`conversationId` 或 `userId` 至少一個）。
- append 以 scope 為單位序列化，避免同一對話併發寫入造成訊息遺失。
- `getRecentMessages` 讀取前會套用 prune（過期清理 + 最大數量）。
- `clearConversation` 會清空 cache，並刪除對應 JSON 主檔與輪轉備份檔（`.json.N`）。

## 6. send() 相容入口

保留 plugin-level `send()`，支援 action：

- `history.append`
- `history.recent`
- `history.clear`

也支援 capability id alias action：

- `system.conversation.history.append`
- `system.conversation.history.recent`
- `system.conversation.history.clear`
