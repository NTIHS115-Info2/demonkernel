# Secrets Usage

本文件說明如何使用 `SecretsManager` 取得密鑰。

## 1. 匯入方式

```ts
import secretsManager, { SECRET_KEYS } from "@core/secrets";
```

## 2. 以 schema id 取值

```ts
const token = secretsManager.get(SECRET_KEYS.DISCORD_TOKEN);
```

## 3. 以 env 變數名取值

```ts
const token = secretsManager.get("DISCORD_TOKEN");
```

## 4. 可選密鑰（不希望 throw）

```ts
const guildId = secretsManager.tryGet(SECRET_KEYS.DISCORD_GUILD_ID);
if (guildId) {
  // optional behavior
}
```

## 5. 重新載入

在測試或熱更新場景可手動重新讀取來源：

```ts
secretsManager.reload();
```

## 6. API 摘要

- `get(key): string`
- `tryGet(key): string | null`
- `has(key): boolean`
- `reload(): void`

## 7. 行為重點

- key 僅接受已註冊的 secret schema id 或 env 名稱。
- 優先序固定為 `process.env > .env`。
- unknown key 在 `get/tryGet/has` 都會 throw。
