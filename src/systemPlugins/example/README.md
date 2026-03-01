# systemPlugins/example

此插件是 `skillPlugins/example` 的 system 版本鏡像，用於示範：

- `meta.type = "system"`
- `runtime.startupWeight` 啟動權重
- throw-only lifecycle 契約

## 對應關係

- 架構與策略分層：對齊 `src/skillPlugins/example`
- 核心差異：manifest `type` 為 `system`

## 參考

- [`src/skillPlugins/example/README.md`](../../skillPlugins/example/README.md)
- [`docs/plugins/overview.md`](../../../docs/plugins/overview.md)
- [`docs/plugins/plugin-sdk.md`](../../../docs/plugins/plugin-sdk.md)
- [`docs/pluginsManager/overview.md`](../../../docs/pluginsManager/overview.md)
