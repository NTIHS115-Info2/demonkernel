# systemPlugins/example

此插件是 `skillPlugins/example` 的 system 版本鏡像，用於示範 `meta.type = "system"` 時的插件結構與生命週期實作方式。

## 對應關係

- 架構、目錄與策略分層：對齊 `src/skillPlugins/example`
- 唯一核心差異：`plugin.manifest.json` 的 `meta.type` 為 `system`
- 日誌語意：使用 `system example plugin ...`

## 參考文件

- 技術模板與填寫規範：[`src/skillPlugins/example/README.md`](../../skillPlugins/example/README.md)
- 插件系統總覽：[`docs/plugins/overview.md`](../../../docs/plugins/overview.md)
- skill example 導讀：[`docs/plugins/example-skill.md`](../../../docs/plugins/example-skill.md)
- plugin-sdk 參考：[`docs/plugins/plugin-sdk.md`](../../../docs/plugins/plugin-sdk.md)
