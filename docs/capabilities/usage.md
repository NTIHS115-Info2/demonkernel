# Capabilities Usage

本文件說明 system 插件如何宣告能力，以及 core 層如何查詢能力描述。

## 1. 在 manifest 宣告能力

`plugin.manifest.json` 新增 `capabilities.provides`：

```json
{
  "capabilities": {
    "provides": ["system.echo.message"]
  }
}
```

`provides` 支援混合格式：

- `string`：引用預設能力 ID。
- `object`：直接提供完整能力表。

範例（混合）：

```json
{
  "capabilities": {
    "provides": [
      "system.echo.message",
      {
        "id": "system.custom.answer",
        "displayName": "Custom Answer",
        "description": "Answer payload and return answer data.",
        "version": "1.0.0",
        "input": {
          "type": "object",
          "properties": {
            "question": { "type": "string" }
          },
          "required": ["question"],
          "additionalProperties": false
        },
        "output": {
          "type": "object",
          "properties": {
            "answer": { "type": "string" }
          },
          "required": ["answer"],
          "additionalProperties": false
        }
      }
    ]
  }
}
```

## 2. PluginsManager 串接流程

1. `discoverPlugins()` 讀取每個 `plugin.manifest.json`。
2. system 插件的 `capabilities.provides` 會被轉交給 `CapabilitiesManager.registerFromManifest()`。
3. 能力驗證或註冊失敗時，插件會被標記為 invalid。

## 3. 查詢能力描述

`CapabilitiesManager` 主要查詢 API：

- `getCapabilityById(id)`
- `listCapabilities()`
- `listProviders(capabilityId)`
- `listCapabilitiesByPlugin(pluginKey)`
- `getSnapshot()`

範例：

```ts
import { CapabilitiesManager } from "@core/capabilities";

const manager = new CapabilitiesManager();

manager.registerFromManifest({
  pluginKey: "system:example",
  pluginType: "system",
  provides: ["system.echo.message"],
});

const providers = manager.listProviders("system.echo.message");
```

## 4. README 同步要求

如果 system 插件新增或修改自帶能力表（`provides` 內的物件），必須同步更新該插件自己的 `README.md`，確保能力描述與文案一致。
