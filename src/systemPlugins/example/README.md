# systemPlugins/example

此插件是 `skillPlugins/example` 的 system 版本鏡像，用於示範：

- `meta.type = "system"`
- `runtime.startupWeight` 啟動權重
- throw-only lifecycle 契約
- `capabilities.provides` 能力宣告
- `getCapabilityBindings()` provider 綁定（`echoMessage`）

## 對應關係

- 架構與策略分層：對齊 `src/skillPlugins/example`
- 核心差異：manifest `type` 為 `system`

## 能力表宣告

此插件在 `plugin.manifest.json` 透過 `capabilities.provides` 宣告能力：

```json
{
  "capabilities": {
    "provides": ["system.echo.message"]
  }
}
```

- 當 `provides` 項目是字串時，代表引用 core 預設能力表 ID。
- 當 `provides` 項目是物件時，代表插件自帶新的能力表定義。
- 如果新增或修改了插件自帶能力表，必須同步更新本 README 的能力說明。

## Provider 綁定

`example` 會透過 `getCapabilityBindings()` 暴露 capability provider：

- `system.echo.message` -> `echoMessage(input)`

`send()` 仍保留為 plugin-level 相容入口，不是 capability 邊界主契約。

## 參考

- [`src/skillPlugins/example/README.md`](../../skillPlugins/example/README.md)
- [`docs/plugins/overview.md`](../../../docs/plugins/overview.md)
- [`docs/plugins/plugin-sdk.md`](../../../docs/plugins/plugin-sdk.md)
- [`docs/pluginsManager/overview.md`](../../../docs/pluginsManager/overview.md)
