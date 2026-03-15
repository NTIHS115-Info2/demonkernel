# Secrets Overview

`core/secrets` 是 Demonkernel 的密鑰存取入口，負責統一管理密鑰來源與查詢規則。

## 1. 核心責任

- 提供唯一密鑰讀取 API（`SecretsManager`）。
- 支援兩種查詢 key：
  - schema id（例如 `discord.application.token`）
  - env 變數名（例如 `DISCORD_TOKEN`）
- 以固定優先序讀值：`process.env > .env`。

## 2. 責任邊界

`core/secrets` 不負責：

- 動態向外部秘密服務（Vault/KMS）請求密鑰
- 密鑰加解密
- 插件參數驗證

本模組僅處理「讀取 + 回傳 + 缺值策略」。

## 3. 缺值與錯誤策略

- `get(key)`：unknown key 或缺值直接 throw。
- `tryGet(key)`：unknown key throw；缺值回 `null`。
- `has(key)`：unknown key throw；有值回 `true`，缺值回 `false`。

## 4. 插件規範

插件不得直接存取 `process.env` 或自行讀取根目錄 `.env`。  
所有密鑰都必須經由 `@core/secrets` 取得，確保行為一致且可測試。
