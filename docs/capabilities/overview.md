# Capabilities Overview

`core/capabilities` 是 system 插件能力描述的統一規範器，負責三件事：

1. 記錄能力描述（含預設能力表與插件宣告能力）。
2. 驗證能力描述格式與衝突。
3. 提供能力查詢 API。

## 責任邊界

能力規範器本次只處理「能力描述」本身，不負責：

- 執行插件能力。
- 路由到哪個插件。
- 對接外部 registry。

`pluginsManager` 在本次更新中的唯一職責是：

- 掃描 manifest 時讀取 `capabilities.provides`。
- 把 system 插件能力宣告交給 `core/capabilities` 記錄與驗證。

## 基本規則

- 只有 `meta.type = "system"` 的插件可以宣告 `capabilities`。
- 能力 ID 全域唯一。
- 以字串引用預設能力 ID 時，若 ID 不存在，插件視為 invalid。
- 若不同插件宣告相同能力 ID 但內容不一致，視為衝突並拒收。

## 與未來 registry 的關係

目前能力規範器先把能力描述整理成可查詢資料。後續若加入 registry，將由 registry 使用這份能力描述做匹配，不會改變本模組「記錄、驗證、查詢」的責任定義。
