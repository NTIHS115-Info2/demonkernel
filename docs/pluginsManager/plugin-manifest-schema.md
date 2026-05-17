# plugin.manifest.json Schema

本文件說明 `plugin.manifest.json` 的完整結構，對齊目前程式實作：

- 型別來源：`src/core/plugin-sdk/types.ts`
- 驗證來源：`src/core/plugin-sdk/manifest.ts`

## 1. 整體結構

```json
{
  "meta": {},
  "runtime": {},
  "dependencies": {},
  "io": {}
}
```

- `meta`：必填
- `runtime`：必填
- `dependencies`：選填（未提供時視為空依賴）
- `io`：選填（文件用途，manager 不做強型別驗證）
- `capabilities`：選填（僅 `system` 插件可使用）

## 2. meta（必填）

```json
{
  "meta": {
    "name": "example",
    "version": "0.0.1",
    "type": "skill",
    "entry": "index.js",
    "description": "optional"
  }
}
```

- `meta.name: string`（必填）
- `meta.version: string`（必填）
- `meta.type: "skill" | "system"`（必填）
- `meta.entry: string`（必填）
- `meta.description?: string`（選填）

## 3. runtime（必填）

```json
{
  "runtime": {
    "startupWeight": 0,
    "method": ["local", "remote"],
    "onlineOptions": {
      "oneOf": []
    },
    "errorCode": {}
  }
}
```

- `runtime.startupWeight: number`（必填）
- `runtime.method: Array<"local" | "remote">`（必填、且不可為空）
- `runtime.onlineOptions?: { oneOf: OnlineOptionsOneOfEntry[] }`（選填）
- `runtime.errorCode?: Record<string, string>`（選填）

重要限制：

1. `runtime.priority` 不支援，出現即驗證失敗。
2. `runtime.onlineOptions.oneOf` 若存在，必須為非空陣列。
3. `oneOf[*].when.method` 必須是 `"local"` 或 `"remote"`，且必須存在於 `runtime.method`。
4. `oneOf[*].schema` 必須存在，且必須包含 `method` 欄位。

## 4. runtime.onlineOptions.oneOf

每個 `oneOf` 項目定義一種 `method` 的上線參數 schema：

```json
{
  "when": { "method": "remote" },
  "schema": {
    "method": { "type": "string", "enum": ["remote"] },
    "url": { "type": "string" },
    "token": { "type": "string", "optional": true }
  }
}
```

欄位型別（`OptionSchemaField`）：

- `{ "type": "string", "enum"?: string[], "optional"?: boolean }`
- `{ "type": "number", "optional"?: boolean }`
- `{ "type": "boolean", "optional"?: boolean }`
- `{ "type": "object", "optional"?: boolean }`

## 5. dependencies（選填）

```json
{
  "dependencies": {
    "skill": {
      "example-skill": "1.0.0"
    },
    "system": {
      "example-system": "2.0.0"
    }
  }
}
```

- `dependencies.skill?: Record<string, string>`
- `dependencies.system?: Record<string, string>`
- value 必須是非空字串（版本採精確比對）

## 6. io（選填）

```json
{
  "io": {
    "input": {},
    "output": {},
    "examples": []
  }
}
```

- `io.input?: Record<string, unknown>`
- `io.output?: Record<string, unknown>`
- `io.examples?: Array<Record<string, unknown>>`

## 7. capabilities（選填，僅 system）

```json
{
  "capabilities": {
    "provides": [
      "system.echo.message",
      {
        "id": "system.custom.answer",
        "displayName": "Custom Answer",
        "description": "Custom capability definition from plugin manifest.",
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
        },
        "testCases": [
          {
            "id": "answer-basic",
            "input": { "question": "hello" },
            "expectedOutput": { "answer": "world" }
          }
        ]
      }
    ]
  }
}
```

規則：

1. `capabilities.provides` 必須是非空陣列。
2. 陣列元素可為：
   - `string`：預設能力表 ID。
   - `object`：完整能力表定義。
3. 若插件型別不是 `system`，不可宣告 `capabilities`。
4. 若宣告 `capabilities.provides`，插件程式碼需同步提供 `getCapabilityBindings()`，讓 manager 建立 capability 專屬 provider methods。

## 8. 完整範例

```json
{
  "meta": {
    "name": "example",
    "version": "0.0.1",
    "description": "this is an example plugin",
    "type": "skill",
    "entry": "index.js"
  },
  "runtime": {
    "startupWeight": 0,
    "method": ["local", "remote"],
    "onlineOptions": {
      "oneOf": [
        {
          "when": { "method": "local" },
          "schema": {
            "method": { "type": "string", "enum": ["local"] },
            "path": { "type": "string", "optional": true }
          }
        },
        {
          "when": { "method": "remote" },
          "schema": {
            "method": { "type": "string", "enum": ["remote"] },
            "url": { "type": "string" },
            "token": { "type": "string", "optional": true }
          }
        }
      ]
    },
    "errorCode": {
      "1000": "未知錯誤",
      "1001": "輸入無效",
      "1002": "處理失敗"
    }
  },
  "dependencies": {
    "system": {},
    "skill": {}
  },
  "io": {
    "input": { "text": "string" },
    "output": { "reply": "string" },
    "examples": [
      {
        "input": { "text": "hello" },
        "output": { "reply": "world" }
      }
    ]
  },
  "capabilities": {
    "provides": ["system.echo.message"]
  }
}
```
