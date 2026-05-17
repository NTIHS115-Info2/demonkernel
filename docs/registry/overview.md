# Registry Overview

`core/registry` 是 capability provider 的查詢入口，負責維護 capability id 到 provider instance 的映射。

## 1. 核心責任

- 註冊 provider：`register(capabilityId, provider, metadata)`
- 查詢 provider：`resolve(capabilityId)` / `tryResolve(capabilityId)`
- 映射檢查：`has(capabilityId)`
- 列舉映射：`list()`

## 2. 責任邊界

Registry 不負責：

- 自動代理 `send()`
- 業務流程編排
- retry / fallback / routing
- tool decision
- chat orchestration

Registry 回傳的是 capability 專屬 provider methods，實際呼叫由使用方 plugin 自行執行：

```ts
const provider = registry.resolve("system.echo.message");
const result = await provider.echoMessage(payload);
```

## 3. 與 CapabilitiesManager 的分工

- `CapabilitiesManager`：能力描述與驗證（capability definition）。
- `CapabilityRegistry`：能力提供者實例映射（capability provider mapping）。

Registry 註冊時會驗證 capability id 必須已存在於 `CapabilitiesManager`。

## 4. 與 pluginsManager 的關係

`pluginsManager` 負責 plugin lifecycle 與 registry 串接：

1. `discoverPlugins()`：重建 capability 描述並清理舊映射。
2. plugin `online` 成功後：由 `getCapabilityBindings()` 建立 provider，註冊到 registry。
3. plugin `offline` 成功後：移除 provider 映射。
4. plugin `restart`：先移除舊映射，成功後重新註冊。

## 5. 錯誤模型

至少包含：

- `CapabilityNotFoundError`
- `CapabilityAlreadyRegisteredError`
- `InvalidCapabilityProviderError`
