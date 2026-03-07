# Capability Schema

能力表採資料導向，描述「輸入資料 -> 輸出資料」，不是描述函式清單。

## 1. 能力表欄位

```ts
type CapabilityDefinition = {
  id: string;
  displayName: string;
  description: string;
  version: string;
  input: CapabilitySchema;
  output: CapabilitySchema;
  testCases?: CapabilityTestCase[];
};
```

必要欄位：

- `id`
- `displayName`
- `description`
- `version`
- `input`
- `output`

可選欄位：

- `testCases`

## 2. JSON Schema Lite（input/output）

```ts
type CapabilitySchema = {
  type: "string" | "number" | "boolean" | "object" | "array" | "null"
      | Array<"string" | "number" | "boolean" | "object" | "array" | "null">;
  description?: string;
  properties?: Record<string, CapabilitySchema>;
  required?: string[];
  items?: CapabilitySchema;
  enum?: unknown[];
  additionalProperties?: boolean | CapabilitySchema;
};
```

## 3. 測試案例（用於契約驗證）

```ts
type CapabilityTestCase = {
  id: string;
  description?: string;
  input: unknown;
  expectedOutput?: unknown;
  expectError?: boolean;
};
```

- `input`：送進插件 `send()` 的資料。
- `expectedOutput`：可選，若提供則會比對實際輸出值。
- `expectError`：可選，設為 `true` 表示此案例預期插件拒絕該輸入。

## 4. 範例

```json
{
  "id": "system.echo.message",
  "displayName": "System Echo Message",
  "description": "Echoes an input message and returns the active runtime method.",
  "version": "1.0.0",
  "input": {
    "type": "object",
    "properties": {
      "message": { "type": "string" }
    },
    "required": ["message"],
    "additionalProperties": true
  },
  "output": {
    "type": "object",
    "properties": {
      "reply": { "type": "string" },
      "method": { "type": "string", "enum": ["local", "remote"] }
    },
    "required": ["reply", "method"],
    "additionalProperties": false
  },
  "testCases": [
    {
      "id": "echo-basic-local",
      "input": { "message": "hello capability" },
      "expectedOutput": { "reply": "hello capability", "method": "local" }
    }
  ]
}
```
