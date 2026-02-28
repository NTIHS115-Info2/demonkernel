# Demonkernel Plugins Overview

本文件描述 Demonkernel 目前的插件系統全貌，包含目錄約定、載入流程、manifest 驗證、online options 驗證與執行期呼叫鏈。

## 1. 目錄與命名

以 `src` 為準的主要目錄：

```text
src/
  core/
    plugin-sdk/
    pluginsManager/
  skillPlugins/
    example/
  systemPlugins/
    example/
```

- `skillPlugins/*`：技能型插件。
- `systemPlugins/*`：系統型插件。
- 每個插件目錄預期至少含 `index.ts` 與 `plugin.manifest.json`。

## 2. 載入流程

目前專案內有兩種相關流程：

1. `PluginsManager` 掃描流程  
   檔案：[`src/core/pluginsManager/index.ts`](../../src/core/pluginsManager/index.ts)
   - 掃描 `skillPlugins` 與 `systemPlugins` 目錄。
   - 每個插件若有 `index.js` 就 `require` 後放入對應 `Map`。
   - 若缺少 `index.js` 會警告並跳過。

2. 啟動範例流程（示範單插件上線）  
   檔案：[`src/index.ts`](../../src/index.ts)
   - 目前固定讀取 `dist/skillPlugins/example`。
   - 先讀 `plugin.manifest.json`。
   - 執行 `validateManifest(manifest)`。
   - 載入 `manifest.meta.entry` 指定的入口。
   - 解析 CLI options 後執行 `validateOnlineOptions(manifest, options)`。
   - 呼叫 `plugin.online(options)`，並在信號時 `plugin.offline()`。

## 3. Manifest 與 Online Options 驗證

驗證函式來源：[`src/core/plugin-sdk/manifest.ts`](../../src/core/plugin-sdk/manifest.ts)

- `validateManifest`
  - 檢查 `meta` 必填：`name/version/type/entry`
  - 檢查 `runtime.priority` 與 `runtime.method`
  - 檢查 `method` 僅允許 `local` / `remote`
  - 檢查 `onlineOptions.oneOf` 與 `runtime.method` 對齊
- `validateOnlineOptions`
  - 檢查 `options.method` 必填
  - 檢查 method 是否在 `runtime.method` 允許清單
  - 依 method 找對應 schema 並做欄位型別/必填驗證

## 4. 執行期呼叫鏈

以 `skillPlugins/example` 為例：

1. Root plugin（`index.ts`）接收 lifecycle 呼叫。
2. `online/restart` 使用 `options.method` 選擇 strategy。
3. Root plugin 記錄當前 `mode`。
4. `offline/state/send` 使用當前 `mode` 轉送到 strategy。
5. strategy 實作具體行為與 `state` 切換。

## 5. Skill / System 插件對照

| 類型 | 目錄 | 主要用途 | 典型內容 |
| --- | --- | --- | --- |
| skill | `src/skillPlugins/*` | 可被業務流程直接調用的技能能力 | chat、NLP、工具技能 |
| system | `src/systemPlugins/*` | 系統層能力與底層服務整合 | 基礎服務、系統支援能力 |

目前 `example` 兩邊都採同一份架構模板，差異集中在 `manifest.meta.type` 與語意層描述。

## 6. 何時選擇 skill 或 system

選擇 `skill`：
- 你要表達的是對外可調用的功能性能力。
- 這個能力可視為業務技能單元。

選擇 `system`：
- 你要表達的是底層支撐能力或系統運作能力。
- 插件屬於核心運行環境的一部分。

## 7. 延伸閱讀

- Skill 範例導讀：[`docs/plugins/example-skill.md`](./example-skill.md)
- Plugin SDK 參考：[`docs/plugins/plugin-sdk.md`](./plugin-sdk.md)
- Skill README 模板：[`src/skillPlugins/example/README.md`](../../src/skillPlugins/example/README.md)
